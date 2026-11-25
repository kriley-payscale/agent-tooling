import assert from 'node:assert/strict'
import { test } from 'node:test'
import { check, isHeldAddition, targetSlug } from './submit-proposals.mjs'

const proposal = (front, body = '') => `---
target: skills/sql-object/SKILL.md      # path under plugins/agent-tooling
section: Naming
kind: correction
submitted-by:
date: 2026-10-30
${front}---

## Change
Use when naming a primary key, use PK_<Table>.

## Replaces
none

## Why
The skill contradicts the schema.

## Evidence
src/Db/Tables/dbo.Example.sql:4
${body}
## Also seen
`

test('targetSlug drops SKILL.md and extensions', () => {
  assert.equal(targetSlug('skills/sql-object/SKILL.md'), 'skills-sql-object')
  assert.equal(targetSlug('skills/pr-review/defect-hunts.md'), 'skills-pr-review-defect-hunts')
  assert.equal(targetSlug('rules/dotnet-unit-tests.mdc'), 'rules-dotnet-unit-tests')
})

test('a complete proposal passes', () => {
  assert.deepEqual(check('2026-10-30-skills-sql-object-pk-naming.md', proposal('')), [])
})

test('file name must match date and target slug', () => {
  assert.match(check('2026-10-30-skills-other-pk.md', proposal('')).join(), /file name/)
})

test('unknown target, bad kind and missing sections fail', () => {
  const text = proposal('').replace('skills/sql-object/SKILL.md', 'skills/nope/SKILL.md').replace('kind: correction', 'kind: idea').replace(/## Why\n.*\n/, '## Why\n\n')
  const problems = check('2026-10-30-skills-nope-x.md', text).join('\n')
  assert.match(problems, /target not found/)
  assert.match(problems, /kind/)
  assert.match(problems, /## Why/)
})

test('submit holds an addition until it has an Also seen line; corrections are never held', () => {
  const addition = proposal('').replace('kind: correction', 'kind: addition')
  assert.equal(isHeldAddition(addition), true)
  assert.equal(isHeldAddition(`${addition}- session-2, 2026-10-31 — same gap in another feature\n`), false)
  assert.equal(isHeldAddition(proposal('')), false)
})

test('credentials are rejected', () => {
  assert.match(check('2026-10-30-skills-sql-object-pk-naming.md', proposal('', 'Server=x;Password=hunter2\n')).join(), /credential/)
})
