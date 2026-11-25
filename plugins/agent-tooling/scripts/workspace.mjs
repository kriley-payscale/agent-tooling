#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const PLUGIN = 'agent-tooling'
const ROLE_PATHS = ['CLIENT', 'DOTNET', 'SQL', 'TILT']
const pluginRoot = fileURLToPath(new URL('../', import.meta.url))
const usage = 'Usage: workspace.mjs --project-dir <workspace root> [--plugin-dir <local agent-tooling plugin>]'
const toPosix = (relative) => relative.replaceAll('\\', '/')

// Opening the repository rather than the role folder keeps a monorepo to one workspace folder.
function repositoryFolder(folder, root) {
  for (let current = folder; current !== root && current.startsWith(root); current = path.dirname(current)) {
    if (fs.existsSync(path.join(current, '.git'))) return current
  }
  return folder
}

function workspaceContents(workspace, paths) {
  const folders = [...new Set(ROLE_PATHS.filter((key) => paths[key]).map((key) => repositoryFolder(paths[key], paths.WORKSPACE)))]
  return {
    folders: [
      { name: PLUGIN, path: '.' },
      ...folders.map((folder) => ({ name: toPosix(path.relative(paths.WORKSPACE, folder)) || '.', path: toPosix(path.relative(workspace, folder)) }))
    ],
    settings: {}
  }
}

try {
  const [flag, project, localFlag, localPlugin, ...extra] = process.argv.slice(2)
  if (flag !== '--project-dir' || !project || !path.isAbsolute(project) || extra.length ||
      (localFlag !== undefined && (localFlag !== '--plugin-dir' || !localPlugin || !path.isAbsolute(localPlugin)))) {
    throw new Error(usage)
  }
  const root = fs.realpathSync(project)
  const workspace = path.join(root, '.cursor', PLUGIN)
  const configFile = path.join(workspace, `${PLUGIN}.local.json`)
  const workspaceFile = path.join(workspace, `${PLUGIN}.code-workspace`)
  const files = new Map()
  let runtimeRoot = pluginRoot
  if (localPlugin !== undefined) {
    const pluginPath = fs.realpathSync(localPlugin)
    const manifest = JSON.parse(fs.readFileSync(path.join(pluginPath, '.cursor-plugin/plugin.json'), 'utf8'))
    if (manifest.name !== PLUGIN) throw new Error('Expected the agent-tooling plugin')
    runtimeRoot = pluginPath
    files.set(path.join(workspace, '.cursor/load-plugin.mjs'), fs.readFileSync(path.join(pluginRoot, 'scripts/load-plugin.mjs'), 'utf8'))
    files.set(path.join(workspace, '.cursor/session-start.mjs'), fs.readFileSync(path.join(pluginRoot, 'scripts/session-start.mjs'), 'utf8'))
    files.set(path.join(workspace, '.cursor/hooks.json'), `${JSON.stringify({ version: 1, hooks: {
      workspaceOpen: [{ command: 'node .cursor/load-plugin.mjs' }],
      sessionStart: [{ command: 'node .cursor/session-start.mjs' }]
    } }, null, 2)}\n`)
  }
  // Validate every destination before setup or any workspace writes.
  for (const file of [...files.keys(), workspaceFile]) {
    let directory = path.dirname(file)
    while (directory !== root) {
      const stat = fs.lstatSync(directory, { throwIfNoEntry: false })
      if (stat && (stat.isSymbolicLink() || !stat.isDirectory())) throw new Error(`Expected local directory without a symlink: ${directory}`)
      directory = path.dirname(directory)
    }
    const stat = fs.lstatSync(file, { throwIfNoEntry: false })
    if (stat && (stat.isSymbolicLink() || !stat.isFile() || (files.has(file) && fs.readFileSync(file, 'utf8') !== files.get(file)))) {
      throw new Error(`Refusing to overwrite existing workspace file: ${file}`)
    }
  }
  const result = spawnSync(process.execPath, [path.join(runtimeRoot, 'scripts/runtime.mjs'),
    ...(fs.existsSync(configFile) ? ['resolve', '--workspace', root] : ['setup', '--project-dir', root])], {
    encoding: 'utf8', timeout: 30_000
  })
  if (result.error) throw result.error
  const runtime = JSON.parse(result.stdout)
  if (result.status !== 0 || runtime.status !== 'ready') throw new Error(runtime.message || 'agent-tooling configuration failed')
  if (localPlugin !== undefined) {
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'))
    if (Object.hasOwn(config, 'pluginPath') && config.pluginPath !== runtimeRoot) {
      throw new Error(`Refusing to overwrite existing pluginPath in ${configFile}`)
    }
    if (config.pluginPath !== runtimeRoot) {
      const temporary = `${configFile}.${process.pid}.tmp`
      fs.writeFileSync(temporary, `${JSON.stringify({ ...config, pluginPath: runtimeRoot }, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
      try {
        fs.renameSync(temporary, configFile)
      } finally {
        if (fs.existsSync(temporary)) fs.unlinkSync(temporary)
      }
    }
  }
  if (!fs.existsSync(workspaceFile)) files.set(workspaceFile, `${JSON.stringify(workspaceContents(workspace, runtime.paths), null, 2)}\n`)
  for (const [file, content] of files) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    if (!fs.existsSync(file)) fs.writeFileSync(file, content, { flag: 'wx', mode: 0o600 })
  }
  process.stdout.write(`${JSON.stringify({ workspaceFile, registration: localPlugin ? 'workspaceOpen' : 'unchanged', runtime }, null, 2)}\n`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
