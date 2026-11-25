import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

try {
  const config = JSON.parse(fs.readFileSync(new URL('../agent-tooling.local.json', import.meta.url), 'utf8'))
  if (typeof config.pluginPath !== 'string' || !path.isAbsolute(config.pluginPath)) {
    throw new Error('Expected an absolute pluginPath in agent-tooling.local.json')
  }
  const pluginPath = fs.realpathSync(config.pluginPath)
  const result = spawnSync(process.execPath, [path.join(pluginPath, 'scripts/runtime.mjs')], {
    input: fs.readFileSync(0),
    encoding: 'utf8'
  })
  if (result.error) throw result.error
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.status !== 0) {
    if (result.stderr) process.stderr.write(result.stderr)
    process.exitCode = result.status ?? 1
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
