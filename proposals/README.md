# Tooling proposals

A proposal records a change to the rules, skills, agents or commands in this repository's plugins (`plugins/<plugin>/`) and why it's needed. It changes no guidance by itself; the plugin owner's promotion PR does. This keeps the guidance improving from evidence: what agents get wrong in real work becomes a proposal, and the owner decides what enters the guidance.

Each plugin has its own queue. `<plugin>` is the plugin's folder name under `plugins/`, which matches the `name` in its `.cursor-plugin/plugin.json`; here it is `agent-tooling`.

```text
proposals/<plugin>/pending/     awaiting a decision
proposals/<plugin>/resolved/    applied, declined or superseded
```

## What to propose

Propose a change when one of these is true:

- **Correction:** existing guidance is wrong, contradicts itself, or contradicts the code.
- **Addition:** guidance is missing, its absence cost something real (rework, a wrong result caught late, an escalation or a reversed decision), and it happened in two unrelated features. Cite the second under `Also seen`; an addition without one waits until it has one.

A defect or convention violation confirmed in review (a local review, a review bot or a PR comment) counts as a wrong result caught late. Target the rule or skill that governs the changed file; when a review ran and missed it, also target that layer's `skills/pr-review/defect-hunts-<layer>.md`. A review comment declined because guidance contradicts the reviewer, while the integration branch follows the reviewer, is a correction against that guidance.

Do not propose:

- Personal or machine-specific setup (your shell, your local paths, your tools).
- Feature-specific details. Guidance must apply across features.
- A case where the guidance existed and was not followed.
- A failure whose error message already named the problem and the fix, unless guidance caused it.
- Application bugs, product docs, third-party tool behavior, speculative improvements, or waits and prerequisites that already have an explicit gate.
- Friction with tooling outside the plugin (local skills, scripts, personal preferences or memories), or a user correction that reflects personal preference rather than wrong guidance.
- Changes to a plugin's excluded targets. For `agent-tooling` these are the always-on runtime rules, `rules/path-token-resolver.mdc` and `rules/environment-resolver.mdc`.

## How to submit proposals

1. **Find the target.** Identify the file under `plugins/<plugin>/` that should change and the section within it.
2. **Check for an existing proposal.** Search `proposals/<plugin>/pending/` and `proposals/<plugin>/resolved/` for the target slug (see step 4).
   - A pending proposal covers it: add a line under its `Also seen` in your PR. If it is still in someone else's open PR, comment there instead.
   - A resolved proposal declined it: resubmit only if your evidence answers the decline reason, and cite that file.
3. **Create a branch** from the repository's default branch: `proposal/<plugin>/<github-handle>-<yyyy-mm-dd>`.
4. **Create one file per proposal:** `proposals/<plugin>/pending/<yyyy-mm-dd>-<target-slug>-<topic>.md`.
   - `<yyyy-mm-dd>` is the proposal's `date`.
   - `<target-slug>` is the target path under `plugins/<plugin>/` with `/SKILL.md` and the file extension dropped and `/` replaced by `-`. For example, `skills/sql-object/SKILL.md` becomes `skills-sql-object`, and `rules/client-build-loops.mdc` becomes `rules-client-build-loops`.
   - `<topic>` is a short kebab-case label, such as `pk-naming`.
5. **Fill in the [template](#template).** Quote exact text in `Replaces`, and quote errors, `file:line` references or command output in `Evidence`. Reviewers cannot open files on your machine.
   - State `Change` in one or two sentences as a pattern that holds across features; feature and ticket names belong in `Evidence`. When it changes when guidance applies, include the new frontmatter description and any shim wording.
   - Prefer rewriting or deleting the sentence that caused the friction over appending, and quote duplicates of the same rule in other files.
   - Leave out recovery steps, execution state, branch or commit status, rejected candidates and agent ids.
6. **Remove sensitive data.** No passwords, tokens, cookies, connection strings or customer data. Replace IDs that identify a customer with placeholders.
7. **Open one PR per plugin** titled `Tooling proposals: <plugin> - <github-handle> <yyyy-mm-dd> (<count>)`. A PR may hold several proposals for one plugin and changes nothing outside `proposals/<plugin>/`. Merging it records the proposals in `pending/`; it does not change any guidance.

### Submit with the script

`submit-proposals.mjs` does steps 3, 4 and 7 through `gh`. Put the proposal files in a folder named `staged/`, outside the clone (for example `<workspace root>/.cursor/agent-tooling/proposals/staged/`), then pass the absolute path of the folder that holds `staged/`:

```bash
node plugins/agent-tooling/scripts/submit-proposals.mjs "<absolute folder that holds staged/>"
```

- It holds back each addition with no `Also seen` entry, printing `Held until a second, unrelated feature sees them: <files>`, and runs the checks below on the rest. Any problem stops it before anything is sent.
- It targets the GitHub repository of the clone it runs from, as `gh repo view` reports it: the `origin` remote in a plain clone. It needs push access there; without it, follow steps 3 to 7 by hand from a fork.
- It creates the branch from that repository's default branch, adding `-2`, `-3` and so on when the name is taken, uploads each file to `proposals/<plugin>/pending/` with `submitted-by` set to your GitHub handle, opens the PR against the default branch with the title above and prints its URL.
- It moves the submitted files to `submitted/<github-handle>-<yyyy-mm-dd>/` beside `staged/`. On an error it prints the error and `Staged files were left in place.`

## Template

```markdown
---
target: skills/<name>/SKILL.md      # path under plugins/<plugin>
section: <section heading in the target>
kind: correction                    # correction | addition
submitted-by: <github-handle>
date: <yyyy-mm-dd>
---

## Change
Use when <trigger>, <guidance>.

## Replaces
"<exact sentence(s) in the target>" | none

## Why
<correction: what is wrong> | <addition: what it cost>

## Evidence
<error text, file:line, command output>

## Also seen
- <other occurrence, date>
```

The guidance checker validates every file in `pending/` on each PR, and the submit script runs the same checks before it sends anything:

- `target` names an existing file under `plugins/<plugin>/`, without `..`.
- `date` is `yyyy-mm-dd`, and the file name starts with `<date>-<target-slug>-`.
- `section` is set, and `kind` is `correction` or `addition`.
- `## Change`, `## Replaces`, `## Why` and `## Evidence` are present and not empty.
- Nothing looks like a credential, such as a password or key assignment, a bearer token or a private key.

## What happens next

The plugin's owner reviews its pending proposals and opens a promotion PR for that plugin only. It edits `plugins/<plugin>/` and, in the same PR, moves each handled proposal from `proposals/<plugin>/pending/` to `proposals/<plugin>/resolved/` with a stamp at the end of the file:

```markdown
- Status: applied | declined | superseded
- Resolved: <yyyy-mm-dd>
- Resolved-in: <target file and section>
- Note: <revision or decline reason>
```

A promotion PR never touches another plugin or its proposals. It must pass the guidance checker, which CI runs: a guidance file over 12 KB can't grow, so cut as much as you add or split the file, and a renamed or deleted target fails every pending proposal that still names it until those proposals are updated or resolved. Resolved proposals are kept so declined ones are not raised again. A promotion that adds or removes a workflow users start themselves also updates the plugin's `USAGE.md`.
