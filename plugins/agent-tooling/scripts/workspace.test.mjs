import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { findTool } from './environment.mjs'

const plugin = fileURLToPath(new URL('../', import.meta.url))
const script = path.join(plugin, 'scripts/workspace.mjs')
const runtimeScript = path.join(plugin, 'scripts/runtime.mjs')
const tooling = '.cursor/agent-tooling'
const configName = 'agent-tooling.local.json'
const nullTools = { dotnet: null, sqlcmd: null, rg: null }
const suffix = process.platform === 'win32' ? '.EXE' : ''

function fixture(t) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-tooling-workspace-'))
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true, maxRetries: 3 }))
  const root = path.join(fs.realpathSync(temporary), 'Workspace with spaces')
  fs.mkdirSync(root, { recursive: true })
  return root
}

function write(file, text = '') {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
  return file
}

function multiRepo(root) {
  write(path.join(root, 'web/angular.json'), '{}')
  write(path.join(root, 'api/Api.sln'))
  write(path.join(root, 'infra/Tiltfile'))
  return root
}

function run(args, entry = script, cwd = os.tmpdir(), env = process.env) {
  const result = spawnSync(process.execPath, [entry, ...args], { cwd, encoding: 'utf8', timeout: 30_000, env })
  assert.ifError(result.error)
  return result
}

function bootstrap(root, localPlugin) {
  return run(['--project-dir', root, ...(localPlugin ? ['--plugin-dir', localPlugin] : [])])
}

const setup = (root, env) => run(['setup', '--project-dir', root], runtimeScript, os.tmpdir(), env)
const resolve = (...roots) => run(['resolve', ...roots.flatMap((root) => ['--workspace', root])], runtimeScript)
const readConfig = (root) => JSON.parse(fs.readFileSync(path.join(root, tooling, configName), 'utf8'))

function success(result) {
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  return JSON.parse(result.stdout)
}

function configure(root, config) {
  return write(path.join(root, tooling, configName), JSON.stringify(config))
}

function installedCopy(root) {
  const target = path.join(root, 'agent-tooling/plugins/agent-tooling')
  fs.cpSync(plugin, target, { recursive: true })
  return target
}

function executable(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, '', { mode: 0o755 })
  return file
}

test('Mac discovery finds Homebrew sqlcmd without PATH and still prefers PATH', { skip: process.platform === 'win32' }, (t) => {
  const home = fixture(t)
  const prefix = path.join(home, 'Homebrew')
  const brewSqlcmd = executable(path.join(prefix, 'opt/mssql-tools18/bin/sqlcmd'))
  const context = { platform: 'darwin', home, env: { PATH: '', HOMEBREW_PREFIX: prefix } }
  assert.equal(findTool('sqlcmd', context), brewSqlcmd)
  const pathSqlcmd = executable(path.join(home, 'custom bin/sqlcmd'))
  context.env.PATH = `"${path.dirname(pathSqlcmd)}"`
  assert.equal(findTool('sqlcmd', context), pathSqlcmd)
  const dotnet = executable(path.join(home, 'sdk/dotnet'))
  context.env.DOTNET_ROOT = path.dirname(dotnet)
  assert.equal(findTool('dotnet', context), dotnet)
})

test('Mac discovery checks standard Apple Silicon and Intel locations', { skip: process.platform === 'win32' }, (t) => {
  const home = fixture(t)
  const available = new Set()
  t.mock.method(fs, 'statSync', (candidate) => ({ isFile: () => available.has(candidate) }))
  t.mock.method(fs, 'accessSync', () => {})
  const context = { platform: 'darwin', home, env: { PATH: '' } }
  for (const file of ['/opt/homebrew/bin/sqlcmd', '/usr/local/bin/sqlcmd', '/usr/local/opt/mssql-tools18/bin/sqlcmd', '/usr/local/share/dotnet/dotnet']) {
    available.add(file)
    assert.equal(findTool(path.basename(file), context), file)
    available.clear()
  }
})

test('Windows discovery finds versioned sqlcmd, respects Program Files roots and PATH', (t) => {
  const home = fixture(t)
  const programFiles = path.join(home, 'Program Files')
  const programFilesX86 = path.join(home, 'Program Files (x86)')
  const context = { platform: 'win32', home, env: { PATH: '', ProgramFiles: programFiles, 'ProgramFiles(x86)': programFilesX86 } }
  const oldSqlcmd = executable(path.join(programFilesX86, 'Microsoft SQL Server/Client SDK/ODBC/170/Tools/Binn/sqlcmd.EXE'))
  const currentSqlcmd = executable(path.join(programFilesX86, 'Microsoft SQL Server/Client SDK/ODBC/180/Tools/Binn/sqlcmd.EXE'))
  assert.equal(findTool('sqlcmd', context), currentSqlcmd)
  fs.unlinkSync(currentSqlcmd)
  assert.equal(findTool('sqlcmd', context), oldSqlcmd)
  const dotnet = executable(path.join(programFiles, 'dotnet/dotnet.EXE'))
  assert.equal(findTool('dotnet', context), dotnet)
  const pathSqlcmd = executable(path.join(home, 'custom bin/sqlcmd.CMD'))
  context.env.PATH = `"${path.dirname(pathSqlcmd)}";${programFiles}`
  context.env.PATHEXT = '.CMD;.EXE'
  assert.equal(findTool('sqlcmd', context), pathSqlcmd)
})

test('setup detects one folder per role in a multi-repository workspace and writes nothing inside them', (t) => {
  const root = multiRepo(fixture(t))
  const runtime = success(setup(root))
  assert.deepEqual(readConfig(root).roles, { client: 'web', dotnet: 'api', tilt: 'infra' })
  assert.equal(runtime.paths.WORKSPACE, root)
  assert.equal(runtime.paths.ARTIFACTS, path.join(root, tooling))
  assert.equal(runtime.paths.CLIENT, path.join(root, 'web'))
  assert.equal(runtime.paths.DOTNET, path.join(root, 'api'))
  assert.equal(runtime.paths.TILT, path.join(root, 'infra'))
  assert(!Object.hasOwn(runtime.paths, 'SQL'))
  for (const name of ['web', 'api', 'infra']) assert.equal(fs.readdirSync(path.join(root, name)).length, 1)
})

test('setup finds roles inside a monorepo, recognizes Nx with Angular only, and the workspace opens the repository once', (t) => {
  const root = fixture(t)
  fs.mkdirSync(path.join(root, 'acme/.git'), { recursive: true })
  write(path.join(root, 'acme/web/nx.json'), '{}')
  write(path.join(root, 'acme/web/package.json'), JSON.stringify({ dependencies: { '@angular/core': '^20.0.0' } }))
  write(path.join(root, 'acme/server/App.slnx'))
  write(path.join(root, 'other/nx.json'), '{}')
  write(path.join(root, 'other/package.json'), JSON.stringify({ dependencies: { react: '^19.0.0' } }))
  const result = success(bootstrap(root))
  assert.deepEqual(readConfig(root).roles, { client: 'acme/web', dotnet: 'acme/server' })
  const workspace = path.join(root, tooling)
  const contents = JSON.parse(fs.readFileSync(result.workspaceFile, 'utf8'))
  assert.deepEqual(contents.folders.map(({ name }) => name), ['agent-tooling', 'acme'])
  assert.deepEqual(contents.folders.map(({ path: relative }) => path.resolve(workspace, relative)), [workspace, path.join(root, 'acme')])
  assert(!fs.existsSync(path.join(root, 'acme/.cursor')))
})

test('setup works for a single repository and refuses a workspace root inside one', (t) => {
  const root = fixture(t)
  fs.mkdirSync(path.join(root, 'my-api/.git'), { recursive: true })
  write(path.join(root, 'my-api/MyApi.sln'))
  const runtime = success(setup(root))
  assert.deepEqual(readConfig(root).roles, { dotnet: 'my-api' })
  assert.equal(runtime.paths.DOTNET, path.join(root, 'my-api'))
  for (const inside of [path.join(root, 'my-api'), path.join(root, 'my-api/src')]) {
    fs.mkdirSync(inside, { recursive: true })
    for (const result of [setup(inside), bootstrap(inside)]) {
      assert.equal(result.status, 1)
      assert.match(result.stdout + result.stderr, /folder that contains your repositories/)
    }
    assert(!fs.existsSync(path.join(inside, '.cursor')))
  }
})

test('setup leaves an ambiguous role unset and names the candidates', (t) => {
  const root = fixture(t)
  write(path.join(root, 'orders/Orders.sln'))
  write(path.join(root, 'orders/tests/Orders.Tests.sln'))
  write(path.join(root, 'billing/Billing.sln'))
  write(path.join(root, 'web/angular.json'), '{}')
  const runtime = success(setup(root))
  assert.deepEqual(readConfig(root).roles, { client: 'web' })
  assert(runtime.warnings.some((warning) => /^dotnet: several folders could hold the dotnet role \(billing, orders\)/.test(warning)), runtime.warnings.join('\n'))
})

test('setup keeps edited roles and refreshes only tool paths', (t) => {
  const root = multiRepo(fixture(t))
  success(setup(root))
  const file = path.join(root, tooling, configName)
  fs.mkdirSync(path.join(root, 'database'))
  fs.writeFileSync(file, JSON.stringify({ ...readConfig(root), roles: { dotnet: 'api', sql: 'database' } }))
  write(path.join(root, 'later/angular.json'), '{}')
  const runtime = success(setup(root))
  assert.deepEqual(readConfig(root).roles, { dotnet: 'api', sql: 'database' })
  assert.equal(runtime.paths.SQL, path.join(root, 'database'))
  assert(!Object.hasOwn(runtime.paths, 'CLIENT'))
  assert(runtime.warnings.some((warning) => /^client: several folders could hold the client role \(later, web\)/.test(warning)), runtime.warnings.join('\n'))
})

test('detection falls back to a project file, looks inside packages/ and follows symlinked repositories', (t) => {
  const root = fixture(t)
  write(path.join(root, 'svc/Svc.csproj'))
  write(path.join(root, 'packages/web/angular.json'), '{}')
  const outside = write(path.join(path.dirname(root), 'outside-infra/Tiltfile'))
  fs.symlinkSync(path.dirname(outside), path.join(root, 'infra'), process.platform === 'win32' ? 'junction' : 'dir')
  const runtime = success(setup(root))
  assert.deepEqual(readConfig(root).roles, { client: 'packages/web', dotnet: 'svc', tilt: 'infra' })
  assert.equal(runtime.paths.TILT, path.join(root, 'infra'))
})

test('a workspace folder that no longer exists does not block the others', (t) => {
  const root = multiRepo(fixture(t))
  success(setup(root))
  const runtime = success(resolve(path.join(root, 'gone'), path.join(root, 'web')))
  assert.equal(runtime.status, 'ready')
  assert.equal(runtime.paths.CLIENT, path.join(root, 'web'))
  const none = resolve(path.join(root, 'gone'))
  assert.equal(none.status, 1)
  assert.match(none.stdout, /None of the workspace roots is an existing folder/)
})

test('a missing role folder blocks only that role', (t) => {
  const root = fixture(t)
  fs.mkdirSync(path.join(root, 'api'))
  configure(root, { roles: { dotnet: 'api', client: 'gone' }, tools: nullTools })
  const runtime = success(resolve(path.join(root, 'api')))
  assert.equal(runtime.status, 'ready')
  assert.equal(runtime.paths.DOTNET, path.join(root, 'api'))
  assert(!Object.hasOwn(runtime.paths, 'CLIENT'))
  assert(runtime.warnings.some((warning) => warning.includes(path.join(root, 'gone')) && warning.includes('roles.client')))
})

test('configuration rejects unknown roles, missing roles and role folders outside the workspace', (t) => {
  const root = fixture(t)
  for (const config of [
    { roles: { frontend: 'web' }, tools: nullTools },
    { roles: { client: path.join(root, 'web') }, tools: nullTools },
    { roles: { client: '../web' }, tools: nullTools },
    { roles: { client: '' }, tools: nullTools },
    { roles: { client: 42 }, tools: nullTools },
    { roles: [], tools: nullTools },
    { tools: nullTools }
  ]) {
    configure(root, config)
    const result = resolve(root)
    assert.equal(result.status, 1)
    assert.match(result.stdout, /roles\.client must be|Unknown role|configuration structure/)
  }
})

test('bootstrap creates a portable workspace and registration only in its dedicated root', (t) => {
  const root = multiRepo(fixture(t))
  const copy = installedCopy(root)
  const result = success(bootstrap(root, copy))
  const workspace = path.dirname(result.workspaceFile)
  assert.equal(workspace, path.join(root, tooling))
  assert.equal(path.basename(result.workspaceFile), 'agent-tooling.code-workspace')
  assert.equal(result.runtime.configFile, path.join(workspace, configName))
  const contents = JSON.parse(fs.readFileSync(result.workspaceFile, 'utf8'))
  assert.deepEqual(contents.folders.map(({ name }) => name), ['agent-tooling', 'web', 'api', 'infra'])
  assert.deepEqual(contents.folders.map(({ path: relative }) => path.resolve(workspace, relative)), [workspace, ...['web', 'api', 'infra'].map((name) => path.join(root, name))])
  assert(!JSON.stringify(contents).includes(root))
  const hooks = JSON.parse(fs.readFileSync(path.join(workspace, '.cursor/hooks.json'), 'utf8'))
  assert.equal(hooks.hooks.workspaceOpen[0].command, 'node .cursor/load-plugin.mjs')
  assert.equal(hooks.hooks.sessionStart[0].command, 'node .cursor/session-start.mjs')
  assert.deepEqual(success(run([], path.join(workspace, '.cursor/load-plugin.mjs'), workspace)), { pluginPaths: [copy] })
  const started = spawnSync(process.execPath, [path.join(workspace, '.cursor/session-start.mjs')], {
    cwd: workspace,
    input: JSON.stringify({ hook_event_name: 'sessionStart', workspace_roots: [workspace] }),
    encoding: 'utf8'
  })
  assert.ifError(started.error)
  assert.equal(started.status, 0, started.stderr)
  assert.match(started.stdout, /AGENT_TOOLING_RUNTIME/)
  const pluginHook = spawnSync(process.execPath, [path.join(copy, 'scripts/runtime.mjs'), '--plugin-hook'], {
    input: JSON.stringify({ hook_event_name: 'sessionStart', workspace_roots: [workspace] }),
    encoding: 'utf8'
  })
  assert.equal(pluginHook.status, 0, pluginHook.stderr)
  assert.deepEqual(JSON.parse(pluginHook.stdout), {})
  assert.equal(result.runtime.paths.CURSOR, copy)
  for (const name of ['web', 'api', 'infra']) assert.equal(fs.readdirSync(path.join(root, name)).length, 1)
  const before = fs.statSync(result.workspaceFile).mtimeMs
  success(bootstrap(root, copy))
  assert.equal(fs.statSync(result.workspaceFile).mtimeMs, before)
  const registration = path.join(workspace, configName)
  const config = JSON.parse(fs.readFileSync(registration, 'utf8'))
  assert.equal(config.pluginPath, copy)
  fs.writeFileSync(registration, JSON.stringify({ ...config, pluginPath: 'relative/plugin' }))
  const invalid = run([], path.join(workspace, '.cursor/load-plugin.mjs'), workspace)
  assert.equal(invalid.status, 1)
  assert.match(invalid.stderr, /absolute pluginPath/)
  fs.writeFileSync(registration, JSON.stringify(config))
  fs.writeFileSync(path.join(copy, '.cursor-plugin/plugin.json'), JSON.stringify({ name: 'another-plugin' }))
  assert.equal(run([], path.join(workspace, '.cursor/load-plugin.mjs'), workspace).status, 1)
})

test('bootstrap without --plugin-dir preserves existing local configuration and creates no registration hook', (t) => {
  const root = multiRepo(fixture(t))
  const config = configure(root, { roles: { client: 'web', dotnet: 'api' }, tools: { dotnet: process.execPath, sqlcmd: null, rg: process.execPath } })
  const content = fs.readFileSync(config, 'utf8')
  const before = fs.statSync(config).mtimeMs
  const result = success(bootstrap(root))
  assert.equal(result.registration, 'unchanged')
  assert.equal(JSON.parse(fs.readFileSync(result.workspaceFile, 'utf8')).folders.length, 3)
  assert(!fs.existsSync(path.join(path.dirname(result.workspaceFile), '.cursor/hooks.json')))
  assert.equal(fs.readFileSync(config, 'utf8'), content)
  assert.equal(fs.statSync(config).mtimeMs, before)
  assert.equal(result.runtime.tools.dotnet, process.execPath)
  const pluginHook = spawnSync(process.execPath, [runtimeScript, '--plugin-hook'], {
    input: JSON.stringify({ hook_event_name: 'sessionStart', workspace_roots: [path.dirname(result.workspaceFile)] }),
    encoding: 'utf8'
  })
  assert.equal(pluginHook.status, 0, pluginHook.stderr)
  assert.match(pluginHook.stdout, /AGENT_TOOLING_RUNTIME/)
})

test('runtime finds workspace-local configuration from every multi-root folder and at session start', (t) => {
  const root = multiRepo(fixture(t))
  const result = success(bootstrap(root))
  const workspace = path.dirname(result.workspaceFile)
  const roots = [workspace, ...['web', 'api', 'infra'].map((name) => path.join(root, name))]
  const resolved = success(resolve(...roots))
  assert.equal(resolved.paths.WORKSPACE, root)
  assert.equal(resolved.paths.ARTIFACTS, workspace)
  assert.equal(resolved.configFile, path.join(workspace, configName))
  const hook = spawnSync(process.execPath, [runtimeScript], {
    input: JSON.stringify({ hook_event_name: 'sessionStart', workspace_roots: roots }), encoding: 'utf8'
  })
  assert.ifError(hook.error)
  assert.equal(hook.status, 0, hook.stderr)
  const snapshot = JSON.parse(JSON.parse(hook.stdout).additional_context.split('\n')[0].slice('AGENT_TOOLING_RUNTIME '.length))
  assert.deepEqual(snapshot, resolved)
})

test('bootstrap keeps an edited workspace file and refuses edited registration, symlink destinations and malformed configuration before writing', (t) => {
  const root = multiRepo(fixture(t))
  const workspace = path.join(root, tooling)
  fs.mkdirSync(path.join(workspace, '.cursor'), { recursive: true })
  const file = path.join(workspace, 'agent-tooling.code-workspace')
  fs.writeFileSync(file, 'User workspace')
  success(bootstrap(root))
  assert.equal(fs.readFileSync(file, 'utf8'), 'User workspace')
  fs.rmSync(path.join(workspace, configName))
  const hooks = path.join(workspace, '.cursor/hooks.json')
  fs.writeFileSync(hooks, 'User hooks')
  const refused = bootstrap(root, plugin)
  assert.equal(refused.status, 1)
  assert.match(refused.stderr, /Refusing to overwrite/)
  assert.equal(fs.readFileSync(hooks, 'utf8'), 'User hooks')
  assert(!fs.existsSync(path.join(workspace, configName)))
  fs.rmSync(workspace, { recursive: true })
  fs.symlinkSync(path.join(root, 'web'), workspace, process.platform === 'win32' ? 'junction' : 'dir')
  assert.equal(bootstrap(root).status, 1)
  assert.deepEqual(fs.readdirSync(path.join(root, 'web')), ['angular.json'])
  fs.unlinkSync(workspace)
  fs.mkdirSync(workspace)
  fs.writeFileSync(path.join(workspace, configName), '{invalid')
  assert.equal(bootstrap(root).status, 1)
  assert.deepEqual(fs.readdirSync(workspace), [configName])
})

test('local registration and configuration survive replacing a plugin snapshot', (t) => {
  const root = multiRepo(fixture(t))
  const copy = installedCopy(root)
  const result = success(bootstrap(root, copy))
  const config = path.join(root, tooling, configName)
  const originalConfig = fs.readFileSync(config, 'utf8')
  const mtime = fs.statSync(config).mtimeMs
  const workspace = path.dirname(result.workspaceFile)
  fs.rmSync(copy, { recursive: true })
  fs.cpSync(plugin, copy, { recursive: true })
  const manifestPath = path.join(copy, '.cursor-plugin/plugin.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  manifest.version = '0.1.1-local-test'
  fs.writeFileSync(manifestPath, JSON.stringify(manifest))
  assert.deepEqual(success(run([], path.join(workspace, '.cursor/load-plugin.mjs'), workspace)), { pluginPaths: [copy] })
  const runtime = success(run(['resolve', '--workspace', workspace], path.join(copy, 'scripts/runtime.mjs')))
  assert.equal(runtime.paths.CURSOR, copy)
  assert.equal(runtime.paths.ARTIFACTS, path.join(root, tooling))
  assert.equal(fs.readFileSync(config, 'utf8'), originalConfig)
  assert.equal(fs.statSync(config).mtimeMs, mtime)
})

test('local setup preserves tool overrides, discovery provenance and the bundle path', (t) => {
  const root = multiRepo(fixture(t))
  const copy = installedCopy(root)
  const original = {
    roles: { client: 'web' },
    tools: { dotnet: process.execPath, sqlcmd: process.execPath, rg: process.execPath },
    discoveredPaths: { sqlcmd: process.execPath }
  }
  const config = configure(root, original)
  success(bootstrap(root, copy))
  assert.deepEqual(JSON.parse(fs.readFileSync(config, 'utf8')), { ...original, pluginPath: copy })
  const contents = fs.readFileSync(config, 'utf8')
  const mtime = fs.statSync(config).mtimeMs
  success(bootstrap(root, copy))
  assert.equal(fs.readFileSync(config, 'utf8'), contents)
  assert.equal(fs.statSync(config).mtimeMs, mtime)
  const refreshed = success(run(['setup', '--project-dir', root], path.join(copy, 'scripts/runtime.mjs')))
  assert.deepEqual(JSON.parse(fs.readFileSync(config, 'utf8')), { ...original, pluginPath: copy })
  assert.deepEqual(refreshed.missingTools, [])
  assert.deepEqual(refreshed.warnings, [])
  assert.deepEqual(success(run([], path.join(root, tooling, '.cursor/load-plugin.mjs'), root)), { pluginPaths: [copy] })
})

test('setup discovers null paths while retaining configured overrides', (t) => {
  const root = fixture(t)
  configure(root, { roles: {}, tools: { dotnet: null, sqlcmd: null, rg: process.execPath } })
  const bin = path.join(root, 'new tool paths')
  const dotnet = executable(path.join(bin, `dotnet${suffix}`))
  const sqlcmd = executable(path.join(bin, `sqlcmd${suffix}`))
  const refreshed = success(setup(root, { ...process.env, PATH: bin, PATHEXT: '.EXE' }))
  assert.deepEqual(refreshed.tools, { dotnet, sqlcmd, rg: process.execPath })
  assert.deepEqual(refreshed.missingTools, [])
})

test('setup refreshes stale detected executables but preserves subsequent manual overrides', (t) => {
  const root = fixture(t)
  const config = configure(root, { roles: {}, tools: { dotnet: null, sqlcmd: process.execPath, rg: process.execPath } })
  const oldDotnet = executable(path.join(root, `tools v1/dotnet${suffix}`))
  const newDotnet = executable(path.join(root, `tools v2/dotnet${suffix}`))
  const refresh = (dotnet) => success(setup(root, { ...process.env, PATH: path.dirname(dotnet), PATHEXT: '.EXE' }))
  assert.equal(refresh(oldDotnet).tools.dotnet, oldDotnet)
  assert.equal(refresh(newDotnet).tools.dotnet, oldDotnet)
  fs.unlinkSync(oldDotnet)
  assert.equal(refresh(newDotnet).tools.dotnet, newDotnet)
  const saved = JSON.parse(fs.readFileSync(config, 'utf8'))
  assert.deepEqual(saved.discoveredPaths, { dotnet: newDotnet })
  fs.writeFileSync(config, JSON.stringify({ ...saved, tools: { ...saved.tools, dotnet: process.execPath } }))
  assert.equal(refresh(newDotnet).tools.dotnet, process.execPath)
  const overridden = JSON.parse(fs.readFileSync(config, 'utf8'))
  assert(!Object.hasOwn(overridden, 'discoveredPaths'))
  refresh(newDotnet)
  assert.deepEqual(JSON.parse(fs.readFileSync(config, 'utf8')), overridden)
})

test('setup rejects invalid discovery provenance before writing configuration', (t) => {
  const root = fixture(t)
  const original = { roles: {}, tools: { dotnet: process.execPath, sqlcmd: null, rg: null } }
  for (const discoveredPaths of [null, [], { unknown: root }, { dotnet: 'relative/path' }, { dotnet: null }, { node: process.execPath }]) {
    const config = configure(root, { ...original, discoveredPaths })
    const contents = fs.readFileSync(config, 'utf8')
    const result = setup(root)
    assert.equal(result.status, 1)
    assert.match(result.stdout, /discoveredPaths/)
    assert.equal(fs.readFileSync(config, 'utf8'), contents)
  }
})

test('setup keeps a detected path when discovery finds nothing and refreshes it on a later retry', (t) => {
  const root = fixture(t)
  const missing = path.join(root, `removed tools/dotnet${suffix}`)
  const original = { roles: {}, tools: { dotnet: missing, sqlcmd: process.execPath, rg: process.execPath }, discoveredPaths: { dotnet: missing } }
  const config = configure(root, original)
  const hideDotnet = "import fs from 'node:fs'; const stat = fs.statSync; fs.statSync = (file, ...rest) => /dotnet(\\.exe)?$/i.test(String(file)) ? undefined : stat(file, ...rest);"
  const unavailable = success(spawnSync(process.execPath, [
    '--import', `data:text/javascript,${encodeURIComponent(hideDotnet)}`,
    runtimeScript, 'setup', '--project-dir', root
  ], { encoding: 'utf8', timeout: 30_000 }))
  assert.equal(unavailable.tools.dotnet, null)
  assert.deepEqual(JSON.parse(fs.readFileSync(config, 'utf8')), original)
  const replacement = executable(path.join(root, `tools v2/dotnet${suffix}`))
  const retry = success(setup(root, { ...process.env, PATH: path.dirname(replacement), PATHEXT: '.EXE' }))
  assert.equal(retry.tools.dotnet, replacement)
  assert.equal(JSON.parse(fs.readFileSync(config, 'utf8')).discoveredPaths.dotnet, replacement)
})

test('setup reports unavailable configured paths without erasing them', (t) => {
  const root = fixture(t)
  const original = { roles: {}, tools: { dotnet: path.join(root, 'inaccessible/dotnet'), sqlcmd: process.execPath, rg: process.execPath } }
  const config = configure(root, original)
  const runtime = success(setup(root))
  assert.deepEqual(JSON.parse(fs.readFileSync(config, 'utf8')), original)
  assert.deepEqual(runtime.missingTools, ['dotnet'])
  assert.equal(runtime.tools.dotnet, null)
  assert.match(runtime.warnings[0], /preserved even when inaccessible.*set its entry to null/)
})

test('ready runtime distinguishes unavailable tools from uninstalled prerequisites and explains blocked work', (t) => {
  const root = fixture(t)
  const config = configure(root, { roles: {}, tools: { dotnet: null, sqlcmd: path.join(root, 'inaccessible/sqlcmd'), rg: null } })
  const runtime = success(resolve(root))
  assert.equal(runtime.status, 'ready')
  assert.match(runtime.message, /Workspace configured.*not found or are inaccessible.*may already be installed/)
  assert.deepEqual(runtime.missingTools, ['dotnet', 'sqlcmd', 'rg'])
  assert.equal(runtime.warnings.length, 4)
  for (const [index, impact] of [/\.NET builds and tests/, /SQL queries/, /Repository searches/].entries()) {
    assert.match(runtime.warnings[index], impact)
    assert(runtime.warnings[index].includes(config))
    assert.match(runtime.warnings[index], /rediscover with \/agent-tooling-setup/)
  }
  assert.match(runtime.warnings[3], /No roles are configured/)
})

test('local setup rejects invalid or conflicting bundle paths without changing existing configuration', (t) => {
  const root = multiRepo(fixture(t))
  const copy = installedCopy(root)
  const workspace = path.join(root, tooling)
  const base = { roles: { client: 'web' }, tools: nullTools }
  for (const pluginPath of ['relative/plugin', null, [], root]) {
    const config = configure(root, { ...base, pluginPath })
    const content = fs.readFileSync(config, 'utf8')
    const result = bootstrap(root, copy)
    assert.equal(result.status, 1)
    assert.match(result.stdout + result.stderr, /pluginPath/)
    assert.equal(fs.readFileSync(config, 'utf8'), content)
    assert(!fs.existsSync(path.join(workspace, 'agent-tooling.code-workspace')))
    assert(!fs.existsSync(path.join(workspace, '.cursor')))
  }
  configure(root, { ...base, unknown: true })
  assert.equal(bootstrap(root, copy).status, 1)
})
