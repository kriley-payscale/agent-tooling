#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TOOL_NAMES, findTool, isRunnableFile } from './environment.mjs'

const PLUGIN = 'agent-tooling'
const ROLES = ['client', 'dotnet', 'sql', 'tilt']
const ROLE_MARKERS = {
  client: (folder, files) => files.includes('angular.json') || (files.includes('nx.json') && dependsOnAngular(folder)),
  dotnet: (folder, files) => files.some((file) => /\.slnx?$/i.test(file)),
  tilt: (folder, files) => files.includes('Tiltfile')
}
const SKIPPED_FOLDERS = new Set(['.git', '.cursor', '.vs', '.vscode', '.idea', '.angular', '.nx', 'node_modules', 'bin', 'obj', 'dist', 'out'])
const pluginRoot = fs.realpathSync(fileURLToPath(new URL('../', import.meta.url)))
const toolingRelative = path.join('.cursor', PLUGIN)
const configRelative = path.join(toolingRelative, `${PLUGIN}.local.json`)
const usage = 'Usage: runtime.mjs setup --project-dir <workspace root> | resolve --workspace <folder> [--workspace <folder> ...]'
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

function enclosingRepository(directory) {
  for (let current = directory; ; current = path.dirname(current)) {
    if (fs.existsSync(path.join(current, '.git'))) return current
    if (path.dirname(current) === current) return null
  }
}

function workspaceRoot(directory) {
  if (!path.isAbsolute(directory)) throw new Error('The workspace root must be an absolute path')
  const root = fs.realpathSync(directory)
  if (!fs.statSync(root).isDirectory()) throw new Error(`The workspace root is not a directory: ${root}`)
  const repository = enclosingRepository(root)
  if (repository) {
    throw new Error(`The workspace root must be the folder that contains your repositories, not one inside a repository: ${root} is in ${repository}. Use the folder that contains that repository.`)
  }
  return root
}

function dependsOnAngular(folder) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'package.json'), 'utf8'))
    return Boolean(manifest.dependencies?.['@angular/core'] || manifest.devDependencies?.['@angular/core'])
  } catch {
    return false
  }
}

function isFolder(entry, location) {
  if (entry.isDirectory()) return true
  if (!entry.isSymbolicLink()) return false
  try {
    return fs.statSync(location).isDirectory()
  } catch {
    return false
  }
}

// Symlinked folders are followed so linked repositories count; the depth limit stops loops.
function detectRoles(root) {
  const found = Object.fromEntries(Object.keys(ROLE_MARKERS).map((role) => [role, []]))
  const projects = []
  const visit = (folder, depth) => {
    let entries
    try {
      entries = fs.readdirSync(folder, { withFileTypes: true })
    } catch {
      return
    }
    const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name)
    for (const [role, matches] of Object.entries(ROLE_MARKERS)) {
      if (matches(folder, files)) found[role].push({ folder, depth })
    }
    if (files.some((file) => /\.csproj$/i.test(file))) projects.push({ folder, depth })
    if (depth === 3) return
    for (const entry of entries) {
      const child = path.join(folder, entry.name)
      if (!SKIPPED_FOLDERS.has(entry.name) && isFolder(entry, child)) visit(child, depth + 1)
    }
  }
  visit(root, 0)
  if (found.dotnet.length === 0) found.dotnet = projects
  const roles = {}
  const ambiguous = {}
  for (const [role, matches] of Object.entries(found).filter(([, candidates]) => candidates.length)) {
    const depth = Math.min(...matches.map((match) => match.depth))
    const folders = matches.filter((match) => match.depth === depth)
      .map((match) => path.relative(root, match.folder).replaceAll('\\', '/') || '.').sort()
    if (folders.length === 1) roles[role] = folders[0]
    else ambiguous[role] = folders
  }
  return { roles, ambiguous }
}

function checkStorage(root) {
  for (const relative of ['.cursor', toolingRelative, configRelative]) {
    const target = path.join(root, relative)
    const stat = fs.lstatSync(target, { throwIfNoEntry: false })
    if (!stat) continue
    if (stat.isSymbolicLink() || (relative === configRelative ? !stat.isFile() : !stat.isDirectory())) {
      throw new Error(`Expected local ${relative === configRelative ? 'file' : 'directory'} without a symlink: ${target}`)
    }
  }
}

function readConfig(root) {
  checkStorage(root)
  const file = path.join(root, configRelative)
  let config
  const text = fs.readFileSync(file, 'utf8')
  try {
    config = JSON.parse(text)
  } catch {
    throw new Error(`Invalid JSON in ${file}`)
  }
  if (!isObject(config) || Object.keys(config).some((key) => !['roles', 'tools', 'pluginPath', 'discoveredPaths'].includes(key)) ||
      !isObject(config.roles) || !isObject(config.tools) || Object.keys(config.tools).some((key) => !TOOL_NAMES.includes(key)) ||
      TOOL_NAMES.some((key) => !Object.hasOwn(config.tools, key))) {
    throw new Error(`Invalid agent-tooling configuration structure: ${file}`)
  }
  for (const [role, folder] of Object.entries(config.roles)) {
    if (!ROLES.includes(role)) throw new Error(`Unknown role ${role} in ${file}; roles are ${ROLES.join(', ')}`)
    const relative = typeof folder === 'string' ? path.relative(root, path.resolve(root, folder)) : ''
    if (typeof folder !== 'string' || !folder || path.isAbsolute(folder) || path.isAbsolute(relative) || relative.split(/[\\/]/)[0] === '..') {
      throw new Error(`roles.${role} must be a folder relative to the workspace root, without "..", in ${file}`)
    }
  }
  if (Object.hasOwn(config, 'pluginPath') && (typeof config.pluginPath !== 'string' || !path.isAbsolute(config.pluginPath))) {
    throw new Error(`pluginPath must be an absolute path in ${file}`)
  }
  if (Object.hasOwn(config, 'discoveredPaths') && (!isObject(config.discoveredPaths) ||
      Object.entries(config.discoveredPaths).some(([key, value]) =>
        !TOOL_NAMES.includes(key) || typeof value !== 'string' || !path.isAbsolute(value)))) {
    throw new Error(`discoveredPaths must contain only known tool names with absolute paths in ${file}`)
  }
  for (const [key, value] of Object.entries(config.tools)) {
    if (value !== null && (typeof value !== 'string' || !path.isAbsolute(value))) {
      throw new Error(`${key} must be an absolute path or null in ${file}`)
    }
  }
  return config
}

function resolveRuntime(workspaceRoots) {
  if (!Array.isArray(workspaceRoots) || workspaceRoots.length === 0 ||
      !workspaceRoots.every((root) => typeof root === 'string' && path.isAbsolute(root))) {
    throw new Error('Expected at least one absolute workspace root')
  }
  const candidates = new Set()
  const existingRoots = workspaceRoots.map((workspace) => process.platform === 'win32'
    // Normalize Cursor's /c:/ Windows paths.
    ? workspace.replace(/^\/([a-zA-Z]:[\\/])/, '$1')
    : workspace).filter((workspace) => fs.statSync(workspace, { throwIfNoEntry: false })?.isDirectory())
  if (existingRoots.length === 0) throw new Error(`None of the workspace roots is an existing folder: ${workspaceRoots.join(', ')}`)
  for (const workspace of existingRoots) {
    let directory = fs.realpathSync(workspace)
    for (;;) {
      if (fs.statSync(path.join(directory, configRelative), { throwIfNoEntry: false })) {
        candidates.add(directory)
        break
      }
      const parent = path.dirname(directory)
      if (parent === directory) break
      directory = parent
    }
  }
  if (candidates.size === 0) {
    return { status: 'setup-required', paths: { CURSOR: pluginRoot }, message: `No ${PLUGIN}.local.json found. Run the agent-tooling-setup command and select the folder that contains your repositories.` }
  }
  if (candidates.size > 1) throw new Error(`Workspace roots resolve to multiple agent-tooling configurations: ${[...candidates].join(', ')}`)
  const root = [...candidates][0]
  const config = readConfig(root)
  const configFile = path.join(root, configRelative)
  const tools = Object.fromEntries(TOOL_NAMES.map((name) => [name, config.tools[name] && isRunnableFile(config.tools[name]) ? config.tools[name] : null]))
  const missingTools = TOOL_NAMES.filter((name) => tools[name] === null)
  const paths = { CURSOR: pluginRoot, WORKSPACE: root, ARTIFACTS: path.join(root, toolingRelative) }
  const roleWarnings = []
  for (const role of ROLES.filter((name) => Object.hasOwn(config.roles, name))) {
    const folder = path.resolve(root, config.roles[role])
    if (fs.statSync(folder, { throwIfNoEntry: false })?.isDirectory()) paths[role.toUpperCase()] = folder
    else roleWarnings.push(`${role}: ${folder} is not a folder, so work for this role is blocked. Point roles.${role} in ${configFile} at the folder that holds it.`)
  }
  if (Object.keys(config.roles).length === 0) {
    roleWarnings.push(`No roles are configured. Set roles in ${configFile} to the folder that holds each of ${ROLES.join(', ')}.`)
  }
  const help = {
    dotnet: '.NET builds and tests require the .NET SDK. Install it or configure tools.dotnet.',
    sqlcmd: 'SQL queries and database verification require a host sqlcmd executable. Install it or configure tools.sqlcmd.',
    rg: 'Repository searches using rg require ripgrep. Install it or configure tools.rg.'
  }
  return {
    status: 'ready',
    message: missingTools.length || roleWarnings.length
      ? 'Workspace configured. Some tools or role folders were not found or are inaccessible; they may already be installed. Only operations requiring them are blocked.'
      : 'Workspace configured. All tool paths and role folders were located; builds and database connectivity have not been tested.',
    paths,
    configFile,
    tools,
    missingTools,
    warnings: [
      ...missingTools.map((name) => `${name}: ${help[name]} Use absolute paths in ${configFile}. Rerun /agent-tooling-setup to refresh stale detected paths. Manual paths are preserved even when inaccessible; correct the path or set its entry to null to rediscover with /agent-tooling-setup.`),
      ...roleWarnings
    ]
  }
}

function setup(directory) {
  const root = workspaceRoot(directory)
  checkStorage(root)
  const configFile = path.join(root, configRelative)
  const existing = fs.existsSync(configFile) ? readConfig(root) : {}
  const discoveredPaths = {}
  function resolvePath(name, configured, isAvailable, discover) {
    // Configurations without provenance must not lose manual overrides.
    if (configured != null && configured !== existing.discoveredPaths?.[name]) return configured
    const resolved = configured && isAvailable(configured) ? configured : discover() ?? configured ?? null
    if (resolved !== null) discoveredPaths[name] = resolved
    return resolved
  }
  const detected = detectRoles(root)
  const roles = existing.roles ?? detected.roles
  const config = {
    roles,
    tools: Object.fromEntries(TOOL_NAMES.map((name) => [name,
      resolvePath(name, existing.tools?.[name], isRunnableFile, () => findTool(name))])),
    ...(Object.keys(discoveredPaths).length ? { discoveredPaths } : {}),
    ...(Object.hasOwn(existing, 'pluginPath') ? { pluginPath: existing.pluginPath } : {})
  }
  fs.mkdirSync(path.dirname(configFile), { recursive: true })
  const temporary = `${configFile}.${process.pid}.tmp`
  fs.writeFileSync(temporary, `${JSON.stringify(config, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
  try {
    fs.renameSync(temporary, configFile)
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary)
  }
  const runtime = resolveRuntime([root])
  for (const [role, folders] of Object.entries(detected.ambiguous).filter(([role]) => !Object.hasOwn(roles, role))) {
    runtime.warnings.push(`${role}: several folders could hold the ${role} role (${folders.join(', ')}). Set roles.${role} in ${configFile} to the one this workspace works in.`)
  }
  return runtime
}

// A local install's workspace also runs this at sessionStart (session-start.mjs) because the plugin
// hook does not fire everywhere; when both are registered the plugin hook stays silent.
const pluginHook = process.argv.length === 3 && process.argv[2] === '--plugin-hook'
const hook = process.argv.length === 2 || pluginHook
const workspaceHasSessionStart = (artifacts) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(artifacts, '.cursor/hooks.json'), 'utf8')).hooks?.sessionStart?.length > 0
  } catch {
    return false
  }
}
let runtime
try {
  if (Number(process.versions.node.split('.')[0]) < 20) throw new Error('agent-tooling requires Node.js 20 or newer')
  const manifest = JSON.parse(fs.readFileSync(path.join(pluginRoot, '.cursor-plugin/plugin.json'), 'utf8'))
  if (manifest.name !== PLUGIN) throw new Error('Expected the agent-tooling plugin manifest')
  const [command, ...args] = process.argv.slice(2)
  if (hook) {
    const input = JSON.parse(fs.readFileSync(0, 'utf8'))
    if (input.hook_event_name !== 'sessionStart') throw new Error('Expected sessionStart hook input')
    runtime = resolveRuntime(input.workspace_roots)
  } else if (command === 'setup' && args.length === 2 && args[0] === '--project-dir') {
    runtime = setup(args[1])
  } else if (command === 'resolve' && args.length > 0 && args.length % 2 === 0 && args.every((value, index) => index % 2 !== 0 || value === '--workspace')) {
    runtime = resolveRuntime(args.filter((value, index) => index % 2 !== 0))
  } else {
    throw new Error(usage)
  }
} catch (error) {
  runtime = { status: 'error', paths: { CURSOR: pluginRoot }, message: error.message }
}
if (hook && pluginHook && runtime.paths?.ARTIFACTS && workspaceHasSessionStart(runtime.paths.ARTIFACTS)) {
  process.stdout.write('{}\n')
} else if (hook) {
  process.stdout.write(`${JSON.stringify({ additional_context: `AGENT_TOOLING_RUNTIME ${JSON.stringify(runtime)}\nResolve path tokens from paths before tool calls. If status is not ready, run setup or report the configuration error before workspace operations. Null tool paths and absent role paths are unavailable; stop only operations requiring them. Keep the installed plugin read-only and write artifacts under ARTIFACTS. Pass this ready AGENT_TOOLING_RUNTIME snapshot explicitly to delegated workers, including status, paths and tools.` })}\n`)
} else {
  process.stdout.write(`${JSON.stringify(runtime, null, 2)}\n`)
  if (runtime.status !== 'ready') process.exitCode = 1
}
