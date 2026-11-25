import fs from 'node:fs'
import path from 'node:path'

try {
  const config = JSON.parse(fs.readFileSync(new URL('../agent-tooling.local.json', import.meta.url), 'utf8'))
  if (typeof config.pluginPath !== 'string' || !path.isAbsolute(config.pluginPath)) {
    throw new Error('Expected an absolute pluginPath in agent-tooling.local.json')
  }
  const pluginPath = fs.realpathSync(config.pluginPath)
  const manifest = JSON.parse(fs.readFileSync(path.join(pluginPath, '.cursor-plugin/plugin.json'), 'utf8'))
  if (manifest.name !== 'agent-tooling') throw new Error('Expected the agent-tooling plugin')
  process.stdout.write(`${JSON.stringify({ pluginPaths: [pluginPath] })}\n`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
