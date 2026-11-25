import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { check as checkProposal } from './submit-proposals.mjs'

export const SIZE_BUDGET = 12 * 1024
const pluginDir = fileURLToPath(new URL('../', import.meta.url))
const GUIDANCE = /^(rules|skills|agents|commands)\/.*\.mdc?$/
const NAMED = /^(skills\/([^/]+)\/SKILL|agents\/([^/]+)|commands\/([^/]+))\.md$/
const PATH_TOKENS = ['CURSOR', 'WORKSPACE', 'ARTIFACTS', 'CLIENT', 'DOTNET', 'SQL', 'TILT']

const walk = (dir, root = dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(dir, e.name), root) : [path.relative(root, path.join(dir, e.name)).replaceAll('\\', '/')])

// Sizes ignore CRLF so a Windows checkout measures the same as the Git blob.
const sizeOf = (text) => Buffer.byteLength(text.replaceAll('\r\n', '\n'))

// Compares against where this branch left main, so a PR is not blamed for files main changed since.
export function gitBaseSize(root, ref = 'origin/main') {
  const base = spawnSync('git', ['-C', root, 'merge-base', 'HEAD', ref], { encoding: 'utf8' }).stdout.trim()
  if (!base) throw new Error(`${ref} not found; run git fetch origin main`)
  return (file) => {
    const result = spawnSync('git', ['-C', root, 'cat-file', '-s', `${base}:./${file}`], { encoding: 'utf8' })
    return result.status === 0 ? Number(result.stdout) : 0
  }
}

export function checkGuidance(root, baseSize) {
  const problems = []
  const report = (file, line, message) => problems.push(`${file}${line ? `:${line}` : ''}: ${message}`)
  const files = walk(root)

  for (const file of files.filter((f) => GUIDANCE.test(f))) {
    const text = fs.readFileSync(path.join(root, file), 'utf8')
    const lines = text.split(/\r?\n/)
    const front = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1]
    const named = file.match(NAMED)
    if (file.endsWith('.mdc') || named) {
      const field = (key) => front?.match(new RegExp(`^${key}:[ \\t]*(.*?)[ \\t]*$`, 'm'))?.[1]
      const description = field('description')
      if (front === undefined) report(file, 1, 'missing frontmatter')
      else if (!description || /^[>|]/.test(description)) report(file, 1, 'description must be a non-empty single line')
      if (named && front !== undefined && field('name') !== named.slice(2).find(Boolean)) report(file, 1, `name must be ${named.slice(2).find(Boolean)}`)
      if (file.endsWith('.mdc') && field('alwaysApply') !== undefined && !/^(true|false)$/.test(field('alwaysApply'))) report(file, 1, 'alwaysApply must be true or false')
    }
    const shim = file.match(/^rules\/skill-shims\/([^/]+)\.mdc$/)?.[1]
    if (shim && !files.includes(`skills/${shim}/SKILL.md`)) report(file, 0, `shim has no skill at skills/${shim}/SKILL.md`)
    else if (shim && !/^disable-model-invocation:[ \t]*true[ \t]*$/m.test(fs.readFileSync(path.join(root, `skills/${shim}/SKILL.md`), 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '')) {
      report(file, 0, `skills/${shim}/SKILL.md needs disable-model-invocation: true, or it is listed twice (skill and shim)`)
    }

    let fenced = false
    lines.forEach((line, i) => {
      if (/^\s*```/.test(line)) fenced = !fenced
      for (const [, token] of line.matchAll(/\{([A-Z][A-Z_]*)\}\//g)) {
        if (!PATH_TOKENS.includes(token)) report(file, i + 1, `{${token}} is not a path token; use ${PATH_TOKENS.map((name) => `{${name}}`).join(', ')}`)
      }
      for (const [, ref] of line.matchAll(/\{CURSOR\}\/([^\s`'"()\]]+)/g)) {
        const target = ref.replace(/#.*$/, '').replace(/[.,;:]+$/, '')
        if (/[<>*{[]|\.\.\./.test(target)) continue
        if (!fs.existsSync(path.join(root, target))) report(file, i + 1, `{CURSOR}/${target} does not exist`)
      }
      if (fenced) return
      for (const [, link] of line.replace(/`[^`]*`/g, '').matchAll(/\]\(([^)\s]+)\)/g)) {
        if (/^(https?:|mailto:|#|\/)|[{<]/.test(link)) continue
        const target = decodeURI(link.replace(/#.*$/, ''))
        if (!fs.existsSync(path.resolve(root, path.dirname(file), target))) report(file, i + 1, `link target ${link} does not exist`)
      }
    })

    const size = sizeOf(text)
    const allowed = Math.max(SIZE_BUDGET, baseSize(file))
    if (size > allowed) {
      report(file, 0, allowed > SIZE_BUDGET
        ? `grew from ${allowed} to ${size} bytes; it is over the ${SIZE_BUDGET}-byte budget, so cut as much as you add`
        : `is ${size} bytes, over the ${SIZE_BUDGET}-byte budget; split it into sub-docs`)
    }
  }

  for (const skillFile of files.filter((f) => /^skills\/[^/]+\/SKILL\.md$/.test(f))) {
    const dir = path.posix.dirname(skillFile)
    const leaves = files.filter((f) => f !== skillFile && f.endsWith('.md') && path.posix.dirname(f) === dir).map((f) => path.posix.basename(f))
    if (!leaves.length) continue
    const body = fs.readFileSync(path.join(root, skillFile), 'utf8').replace(/^---\r?\n[\s\S]*?\r?\n---/, '')
    const mapLines = (body.split(/^(?=## )/m)[1] ?? '').split(/\r?\n/)
    const start = mapLines.findIndex((line) => line.startsWith('|'))
    const end = mapLines.findIndex((line, i) => i > start && !line.startsWith('|'))
    const rows = start < 0 ? [] : mapLines.slice(start, end < 0 ? undefined : end)
    if (!/^## Guidance map\s*$/.test(mapLines[0]) || !/^\|\s*When\s*\|\s*Read\s*\|?\s*$/.test(rows[0] ?? '')) {
      report(skillFile, 0, 'a skill with leaves needs `## Guidance map` as its first ## section, holding a `| When | Read |` table')
      continue
    }
    // The Read cell is the last cell of a row. Link text and another skill's leaf with the same file name do not count.
    const readCell = (row) => row.replace(/\|\s*$/, '').split(/(?<!\\)\|/).at(-1).replace(/\[[^\]]*\]\(/g, '(').replaceAll(`{CURSOR}/${dir}/`, '').replaceAll('(./', '(')
    for (const leaf of leaves) {
      const named = new RegExp(`(?<![\\w./-])${leaf.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\w)`)
      const count = rows.filter((row) => named.test(readCell(row))).length
      if (count !== 1) report(skillFile, 0, `Guidance map names ${leaf} in the Read cell of ${count} rows; each leaf needs exactly one`)
    }
  }

  for (const file of files.filter((f) => f.endsWith('.json') || f.endsWith('.code-workspace'))) {
    try {
      JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
    } catch (error) {
      report(file, 0, `invalid JSON: ${error.message}`)
    }
  }

  const pending = path.join(root, '../../proposals', path.basename(root), 'pending')
  if (fs.existsSync(pending)) {
    for (const name of fs.readdirSync(pending).filter((n) => n.endsWith('.md'))) {
      for (const problem of checkProposal(name, fs.readFileSync(path.join(pending, name), 'utf8'), root)) {
        report(`proposals/${path.basename(root)}/pending/${name}`, 0, problem)
      }
    }
  }
  return problems
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  try {
    if (process.argv.length > 2) throw new Error('Usage: check-guidance.mjs')
    const problems = checkGuidance(pluginDir, gitBaseSize(pluginDir))
    for (const problem of problems) console.error(problem)
    console.log(problems.length ? `${problems.length} problem(s)` : 'Guidance checks passed')
    process.exitCode = problems.length ? 1 : 0
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
