import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { findTool } from './environment.mjs'

const pluginDir = fileURLToPath(new URL('../', import.meta.url))
const plugin = JSON.parse(fs.readFileSync(path.join(pluginDir, '.cursor-plugin/plugin.json'), 'utf8')).name
const SECRET = /password\s*[=:]|pwd\s*=|accountkey\s*=|bearer\s+[\w.~+/-]{20,}|eyJ[\w-]{10,}\.[\w-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY/i

export function isHeldAddition(text) {
  const alsoSeen = text.match(/^## Also seen[ \t]*\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/m)?.[1] ?? ''
  return /^kind:[ \t]*addition\b/m.test(text) && !/^\s*-\s*\S/m.test(alsoSeen)
}

export function targetSlug(target) {
  return target.replace(/\/SKILL\.md$/, '').replace(/\.[^/.]+$/, '').replaceAll('/', '-')
}

export function check(name, text, root = pluginDir) {
  const problems = []
  const front = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? ''
  const field = (key) => front.match(new RegExp(`^${key}:[ \\t]*([^#\\r\\n]*?)[ \\t]*(#.*)?$`, 'm'))?.[1] ?? ''
  const target = field('target')
  const date = field('date')
  if (!target || target.includes('..') || !fs.existsSync(path.join(root, target))) problems.push(`target not found in the plugin: ${target || '(missing)'}`)
  else if (!name.startsWith(`${date}-${targetSlug(target)}-`)) problems.push(`file name must be ${date || '<date>'}-${targetSlug(target)}-<topic>.md`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) problems.push('date must be yyyy-mm-dd')
  if (!field('section')) problems.push('section is missing')
  if (!['correction', 'addition'].includes(field('kind'))) problems.push('kind must be correction or addition')
  for (const heading of ['Change', 'Replaces', 'Why', 'Evidence']) {
    const body = text.match(new RegExp(`^## ${heading}[ \\t]*\\r?\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm'))?.[1].trim()
    if (!body) problems.push(`## ${heading} is missing or empty`)
  }
  if (SECRET.test(text)) problems.push('looks like it contains a credential; remove it')
  return problems
}

function gh(args, input) {
  const result = spawnSync(findTool('gh') ?? 'gh', args, { input, encoding: 'utf8', cwd: pluginDir })
  if (result.error) throw new Error('gh is not installed')
  return result
}

function ghOut(args, input) {
  const result = gh(args, input)
  if (result.status) throw new Error(result.stderr.trim() || `gh ${args.join(' ')} failed`)
  return result.stdout.trim()
}

function submit(dir) {
  const staged = path.join(dir, 'staged')
  const all = fs.existsSync(staged) ? fs.readdirSync(staged).filter((file) => file.endsWith('.md')).sort() : []
  const texts = Object.fromEntries(all.map((file) => [file, fs.readFileSync(path.join(staged, file), 'utf8')]))
  const held = all.filter((file) => isHeldAddition(texts[file]))
  if (held.length) console.log(`Held until a second, unrelated feature sees them: ${held.join(', ')}`)
  const files = all.filter((file) => !held.includes(file))
  if (!files.length) return console.log('Nothing to submit.')
  const problems = files.flatMap((file) => check(file, texts[file]).map((problem) => `${file}: ${problem}`))
  if (problems.length) throw new Error(problems.join('\n'))
  const { nameWithOwner: repo, defaultBranchRef: { name: baseBranch } } = JSON.parse(ghOut(['repo', 'view', '--json', 'nameWithOwner,defaultBranchRef']))

  const handle = ghOut(['api', 'user', '--jq', '.login'])
  if (ghOut(['api', `repos/${repo}`, '--jq', '.permissions.push']) !== 'true') throw new Error(`${handle} cannot push to ${repo}`)
  const date = new Date().toLocaleDateString('en-CA')
  let name = `${handle}-${date}`
  for (let n = 2; gh(['api', `repos/${repo}/git/ref/heads/proposal/${plugin}/${name}`]).status === 0; n++) name = `${handle}-${date}-${n}`
  const branch = `proposal/${plugin}/${name}`

  const base = ghOut(['api', `repos/${repo}/git/ref/heads/${baseBranch}`, '--jq', '.object.sha'])
  ghOut(['api', '-X', 'POST', `repos/${repo}/git/refs`, '--input', '-'], JSON.stringify({ ref: `refs/heads/${branch}`, sha: base }))
  for (const file of files) {
    const repoPath = `proposals/${plugin}/pending/${file}`
    const existing = gh(['api', `repos/${repo}/contents/${repoPath}?ref=${branch}`, '--jq', '.sha'])
    const text = existing.status === 0 ? texts[file] : texts[file].replace(/^submitted-by:.*$/m, `submitted-by: ${handle}`)
    const body = { message: `Propose ${file}`, branch, content: Buffer.from(text).toString('base64') }
    if (existing.status === 0) body.sha = existing.stdout.trim()
    ghOut(['api', '-X', 'PUT', `repos/${repo}/contents/${repoPath}`, '--input', '-'], JSON.stringify(body))
  }
  const url = ghOut(['pr', 'create', '-R', repo, '--base', baseBranch, '--head', branch,
    '--title', `Tooling proposals: ${plugin} - ${handle} ${date} (${files.length})`,
    '--body', files.map((file) => `- \`${file}\``).join('\n')])

  const done = path.join(dir, 'submitted', name)
  fs.mkdirSync(done, { recursive: true })
  for (const file of files) fs.renameSync(path.join(staged, file), path.join(done, file))
  console.log(url)
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  const dir = process.argv[2]
  try {
    if (!dir || !path.isAbsolute(dir)) throw new Error('Usage: node submit-proposals.mjs <absolute folder that holds staged/>')
    submit(dir)
  } catch (error) {
    console.error(`${error.message}\nStaged files were left in place.`)
    process.exitCode = 1
  }
}
