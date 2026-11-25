#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CURL = process.platform === 'win32' ? 'curl.exe' : 'curl';
const STATUS_FORMAT = '\\n%{http_code}';
const TOOLING_DIR = path.join(os.homedir(), '.agent-tooling');
const CREDENTIALS_FILE = path.join(TOOLING_DIR, 'credentials');
const SESSIONS_DIR = path.join(TOOLING_DIR, 'sessions');
const PLACEHOLDER = 'replace-with-';
const SECRET_KEY = /token|secret|password/i;

const USAGE = `Usage: api.mjs login <path> <JSON_TEMPLATE | -> [--as ACTOR] [--token FIELD] [--base-url URL]
       api.mjs call <METHOD> <path> [JSON_BODY | -] [--as ACTOR] [--base-url URL]
       api.mjs call <METHOD> <path> --form FIELD=VALUE [--form FIELD=VALUE ...] [--as ACTOR] [--base-url URL]
login fills \${KEY} placeholders from the environment, then ~/.agent-tooling/credentials.
Both print the response body, then the HTTP status as the last line; login redacts token, secret and password values.
Sessions are kept in ~/.agent-tooling/sessions/<ACTOR>.cookies and <ACTOR>.token.`;

const VALUE_FLAGS = ['--as', '--base-url', '--form', '--token'];
const ALLOWED_FLAGS = {
  login: ['--as', '--base-url', '--token'],
  call: ['--as', '--base-url', '--form'],
};

class CliError extends Error {
  constructor(exitCode, message) {
    super(message);
    this.exitCode = exitCode;
  }
}

function usage(message) {
  throw new CliError(2, message ? `${USAGE}\nError: ${message}` : USAGE);
}

function parseArgs(argv) {
  const positionals = [];
  const flags = { form: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (VALUE_FLAGS.includes(arg)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) usage(`${arg} requires a value`);
      i++;
      if (arg === '--form') flags.form.push(value);
      else flags[arg.slice(2)] = value;
    } else if (arg.startsWith('--')) {
      usage(`unknown option: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, flags };
}

function assertFlagsAllowed(command, argv) {
  for (const arg of argv) {
    if (VALUE_FLAGS.includes(arg) && !ALLOWED_FLAGS[command].includes(arg)) {
      usage(`${arg} is not valid for ${command}`);
    }
  }
}

function parseCredentialValue(raw) {
  const quote = raw[0];
  if (quote === "'") {
    const end = raw.indexOf("'", 1);
    return end < 0 ? raw.slice(1) : raw.slice(1, end);
  }
  if (quote === '"') {
    let value = '';
    for (let i = 1; i < raw.length; i++) {
      const char = raw[i];
      if (char === '\\' && '"\\$`'.includes(raw[i + 1] ?? '')) {
        value += raw[++i];
      } else if (char === '"') {
        return value;
      } else {
        value += char;
      }
    }
    return value;
  }
  return raw.replace(/\s+#.*$/, '').trim();
}

function readCredentialsFile() {
  let text;
  try {
    text = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.trim().match(/^(?:export\s+)?([A-Za-z_]\w*)\s*=\s*(.*)$/);
    if (match) values[match[1]] = parseCredentialValue(match[2]);
  }
  return values;
}

// The environment wins over the file, as with node --env-file and dotenv.
function setting(key, file) {
  const values = [process.env[key], file[key]].filter(Boolean);
  const value = values.find((candidate) => !candidate.startsWith(PLACEHOLDER));
  if (!value && values.length) throw new CliError(1, `${key} still holds the template placeholder in ~/.agent-tooling/credentials`);
  return value;
}

function baseUrl(flags, file) {
  const url = flags['base-url'] || setting('API_BASE_URL', file);
  if (!url) throw new CliError(1, `No base URL. Pass --base-url or set API_BASE_URL in ${CREDENTIALS_FILE}`);
  return url.replace(/\/+$/, '');
}

function actorFiles(flags) {
  const actor = flags.as ?? 'default';
  if (!/^[\w-]+$/.test(actor)) usage('--as takes letters, digits, _ and - only');
  const stem = path.join(SESSIONS_DIR, actor);
  return { actor, jar: `${stem}.cookies`, token: `${stem}.token` };
}

function clearSession(jar, token) {
  fs.rmSync(jar, { force: true });
  fs.rmSync(token, { force: true });
}

// Values are JSON-escaped so a quote or backslash in a password cannot break the body.
function fillTemplate(template, file) {
  const body = template.replace(/\$\{([A-Za-z_]\w*)\}/g, (_, key) => {
    const value = setting(key, file);
    if (!value) throw new CliError(1, `${key} is not set. Add it to ${CREDENTIALS_FILE}`);
    return JSON.stringify(value).slice(1, -1);
  });
  try {
    JSON.parse(body);
  } catch {
    usage('the body template is not valid JSON once its placeholders are filled');
  }
  return body;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// Bodies go to curl on stdin, never argv, so Windows argv quoting cannot corrupt passwords or JSON.
function runCurl(args, { input, capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(CURL, args, {
      stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'inherit'],
    });
    const chunks = [];
    if (capture) child.stdout.on('data', (chunk) => chunks.push(chunk));
    else child.stdout.pipe(process.stdout, { end: false });
    child.on('error', (error) => reject(new CliError(1, `Failed to run ${CURL}: ${error.message}`)));
    child.on('close', (code) => resolve({ code: code ?? 1, stdout: Buffer.concat(chunks).toString('utf8') }));
    if (input !== undefined) {
      child.stdin.on('error', () => {});
      child.stdin.end(input);
    }
  });
}

// Booleans stay readable so a password-expired or first-login flag still shows.
function redact(value, secret = false) {
  if (Array.isArray(value)) return value.map((item) => redact(item, secret));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redact(item, secret || SECRET_KEY.test(key))]));
  }
  return secret && (typeof value === 'string' || typeof value === 'number') ? '[redacted]' : value;
}

function printableBody(body) {
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return body;
  }
  const redacted = JSON.stringify(typeof parsed === 'string' ? '[redacted]' : redact(parsed));
  return redacted === JSON.stringify(parsed) ? body : redacted;
}

function saveBearerToken(body, field, tokenFile) {
  let token;
  try {
    const parsed = JSON.parse(body);
    token = field === '.' ? parsed : field.split('.').reduce((value, key) => value?.[key], parsed);
  } catch {}
  if (typeof token !== 'string' || !token) {
    console.error(`No string field "${field}" in the login response; no bearer token saved`);
    return;
  }
  fs.writeFileSync(tokenFile, `Authorization: Bearer ${token}\n`, { mode: 0o600 });
}

async function login(positionals, flags) {
  if (positionals.length !== 2) usage('login takes a path and a JSON body template');
  const [loginPath, templateArg] = positionals;
  const file = readCredentialsFile();
  const url = `${baseUrl(flags, file)}${loginPath}`;
  const template = templateArg === '-' ? (await readStdin()).toString('utf8') : templateArg;
  const body = fillTemplate(template, file);
  const { jar, token } = actorFiles(flags);
  fs.mkdirSync(SESSIONS_DIR, { recursive: true, mode: 0o700 });
  clearSession(jar, token);
  fs.writeFileSync(jar, '', { mode: 0o600 });

  const { code, stdout } = await runCurl(
    ['-sSk', '-w', STATUS_FORMAT, '-c', jar, '-X', 'POST', url,
      '-H', 'Content-Type: application/json', '-H', 'Accept: application/json', '--data-binary', '@-'],
    { input: body, capture: true },
  );
  const split = stdout.lastIndexOf('\n');
  const response = stdout.slice(0, split);
  const status = stdout.slice(split + 1);
  if (!/^[23]\d\d$/.test(status)) clearSession(jar, token);
  else if (flags.token) saveBearerToken(response, flags.token, token);
  process.stdout.write(`${printableBody(response)}\n${status}`);
  return code;
}

async function call(positionals, flags) {
  if (positionals.length < 2) usage('METHOD and path are required');
  const [method, requestPath, ...rest] = positionals;
  if (rest.length > 1) usage('call takes at most one body argument');

  const args = [];
  let input;
  if (flags.form.length > 0) {
    if (rest.length > 0) usage('--form cannot be combined with a JSON body');
    for (const form of flags.form) {
      if (form.indexOf('=') < 1) usage('--form takes FIELD=VALUE with a non-empty field name');
      args.push('--form', form);
    }
  } else {
    args.push('-H', 'Content-Type: application/json');
    const body = rest[0] === '-' ? await readStdin() : (rest[0] ?? '');
    if (body.length > 0) {
      args.push('--data-binary', '@-');
      input = body;
    }
  }

  const { actor, jar, token } = actorFiles(flags);
  if (!fs.existsSync(jar)) throw new CliError(1, `No session for actor "${actor}". Run login --as ${actor} first`);
  if (fs.existsSync(token)) args.push('-H', `@${token}`);
  const url = `${baseUrl(flags, readCredentialsFile())}${requestPath}`;

  const { code } = await runCurl(
    ['-sSk', '-w', STATUS_FORMAT, '-b', jar, '-c', jar, '-X', method, url, '-H', 'Accept: application/json', ...args],
    { input },
  );
  return code;
}

async function main(argv) {
  const { positionals, flags } = parseArgs(argv);
  const [command, ...rest] = positionals;
  if (!command) usage('a subcommand is required');
  if (!Object.hasOwn(ALLOWED_FLAGS, command)) usage(`unknown subcommand: ${command}`);
  assertFlagsAllowed(command, argv);
  return command === 'login' ? login(rest, flags) : call(rest, flags);
}

main(process.argv.slice(2)).then(
  (exitCode) => {
    process.exitCode = exitCode;
  },
  (error) => {
    if (!(error instanceof CliError)) throw error;
    console.error(error.message);
    process.exitCode = error.exitCode;
  },
);
