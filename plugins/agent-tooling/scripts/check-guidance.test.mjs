import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { checkGuidance, SIZE_BUDGET } from './check-guidance.mjs'

function plugin(t, files) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'guidance-'))
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }))
  const root = path.join(repo, 'plugins/agent-tooling')
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true })
    fs.writeFileSync(path.join(repo, file), text)
  }
  return root
}

const skill = '---\nname: demo\ndescription: "Use when demoing."\ndisable-model-invocation: true\n---\n'
const map = '# Demo\n\n## Guidance map\n\n| When | Read |\n|---|---|\n| The sub case applies | [sub.md](sub.md) |\n\n'
const clean = {
  'plugins/agent-tooling/skills/demo/SKILL.md': `${skill}${map}See [sub](sub.md) and \`{CURSOR}/skills/demo/sub.md\`.\n\`\`\`sql\nON [t]([Create_Date])\n\`\`\`\n`,
  'plugins/agent-tooling/skills/demo/sub.md': '# Sub\n',
  'plugins/agent-tooling/rules/skill-shims/demo.mdc': '---\ndescription: "Use when demoing."\nalwaysApply: false\n---\n',
  'plugins/agent-tooling/hooks.json': '{}'
}

test('a consistent plugin passes, ignoring link-like text inside code', (t) => {
  assert.deepEqual(checkGuidance(plugin(t, clean), () => 0), [])
})

test('reports broken frontmatter, shims, references, links and JSON', (t) => {
  const root = plugin(t, {
    ...clean,
    'plugins/agent-tooling/skills/demo/SKILL.md': '---\nname: other\ndescription: >-\n---\nSee [gone](gone.md) and `{CURSOR}/rules/gone.mdc`.\n',
    'plugins/agent-tooling/rules/skill-shims/missing.mdc': '---\ndescription: "x"\n---\n',
    'plugins/agent-tooling/skills/listed/SKILL.md': '---\nname: listed\ndescription: "Use when listing."\n---\n',
    'plugins/agent-tooling/rules/skill-shims/listed.mdc': '---\ndescription: "Use when listing."\n---\n',
    'plugins/agent-tooling/rules/plain.mdc': 'no frontmatter\n',
    'plugins/agent-tooling/hooks.json': '{',
    'proposals/agent-tooling/pending/bad.md': '---\ntarget: rules/gone.mdc\n---\n'
  })
  const problems = checkGuidance(root, () => 0).join('\n')
  for (const expected of ['description must be', 'name must be demo', 'link target gone.md', '{CURSOR}/rules/gone.mdc does not exist',
    'shim has no skill at skills/missing/SKILL.md', 'plain.mdc:1: missing frontmatter', 'skills/listed/SKILL.md needs disable-model-invocation: true', 'hooks.json: invalid JSON', 'pending/bad.md: target not found']) {
    assert.match(problems, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('a skill with leaves needs a leading Guidance map naming each leaf in exactly one row', (t) => {
  const check = (body, extra = {}) => checkGuidance(plugin(t, { ...clean, ...extra, 'plugins/agent-tooling/skills/demo/SKILL.md': `${skill}${body}` }), () => 0).join('\n')
  assert.match(check('# Demo\n\nSee [sub.md](sub.md).\n'), /needs `## Guidance map` as its first ## section/)
  assert.match(check(`# Demo\n\n## Steps\n\n${map.replace('# Demo\n\n', '')}`), /as its first ## section/)
  assert.match(check(map.replace('| When | Read |', '| Open | When |')), /holding a `\| When \| Read \|` table/)
  assert.match(check(`${map.trimEnd()}\n| Again | [sub.md](sub.md) |\n`), /names sub\.md in the Read cell of 2 rows/)
  const two = { 'plugins/agent-tooling/skills/demo/final-sub.md': '# Final\n' }
  assert.match(check(map.replaceAll('sub.md', 'final-sub.md'), two), /names sub\.md in the Read cell of 0 rows/)
  assert.equal(check(`${map.trimEnd()}\n| The final case applies | [final-sub.md](final-sub.md) |\n`, two), '')
})

test('the Guidance map check reads the last cell of the first table and counts only the skill\'s own leaves', (t) => {
  const check = (body) => checkGuidance(plugin(t, { ...clean, 'plugins/agent-tooling/skills/demo/SKILL.md': `${skill}${body}` }), () => 0).join('\n')
  const head = '# Demo\n\n## Guidance map\n\n| When | Read |\n|---|---|\n'
  const missing = /names sub\.md in the Read cell of 0 rows/
  assert.equal(check(`${head}| The sub case applies | [sub.md](sub.md)\n`), '')
  assert.equal(check(`${head}| The sub case applies | \`{CURSOR}/skills/demo/sub.md\` and \`a \\| b\` |\n`), '')
  assert.equal(check(`${head}| The sub case applies | [the sub leaf](./sub.md) |\n`), '')
  assert.match(check(`${head}| Link text names it | [sub.md](../other/sub.md) |\n`), missing)
  assert.match(check(`${head}| A longer file name | \`x.sub.md\` |\n`), missing)
  assert.match(check(`${head}| sub.md is named only here | rule \`other\` |\n`), missing)
  assert.match(check(`${head}| Another skill's leaf | \`{CURSOR}/skills/other/sub.md\` |\n`), missing)
  assert.match(check(`${head}| A rule with the same stem | rule file sub.mdc |\n`), missing)
  assert.equal(check(`${head}| The sub case applies | [sub.md](sub.md) |\n\nLater in the section:\n\n| Field | Goes to |\n|---|---|\n| again | sub.md |\n`), '')
})

test('files over budget may shrink or hold, never grow; CRLF counts as LF', (t) => {
  const big = `${skill}${map}${'x'.repeat(SIZE_BUDGET)}\n`
  const root = plugin(t, { ...clean, 'plugins/agent-tooling/skills/demo/SKILL.md': big.replaceAll('\n', '\r\n') })
  const size = Buffer.byteLength(big)
  assert.deepEqual(checkGuidance(root, () => size), [])
  assert.match(checkGuidance(root, () => size - 1).join(), /grew from/)
  assert.match(checkGuidance(root, () => 0).join(), /over the \d+-byte budget; split it/)
})

test('reports brace path tokens the runtime does not define', (t) => {
  const root = plugin(t, { ...clean, 'plugins/agent-tooling/rules/tokens.mdc': '---\ndescription: "Use when testing tokens."\n---\nRun from `{DEVELOPMENT}/Client` or `{CLIENT}/apps`.\n' })
  const problems = checkGuidance(root, () => 0).join('\n')
  assert.match(problems, /tokens\.mdc:4: \{DEVELOPMENT\} is not a path token/)
  assert.doesNotMatch(problems, /\{CLIENT\} is not/)
})
