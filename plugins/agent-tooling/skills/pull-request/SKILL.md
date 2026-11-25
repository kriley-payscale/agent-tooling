---
name: pull-request
description: Use when pushing a feature branch and opening its GitHub pull request from the repository's PR template, or a linked set of PRs across repositories (for example an API and the client that calls it). Not for code review or merging.
disable-model-invocation: true
---

# Open a pull request

`<owner>/<repo>` is the PR's repository: `gh repo view --json nameWithOwner -q .nameWithOwner`, run in the checkout. When `origin` is your fork, confirm this names the upstream repository, not the fork.

## Preflight (per repository)

1. On the feature branch, never the default branch or another long-lived branch; working tree clean (`git status --short` empty).
2. Keep the branch's commits; do not squash before or during review. Each commit is one reviewable step whose subject says what it changes, in the repository's existing style. `Address PR feedback`, `fixes` and `WIP` are not subjects. Reword or regroup unclear commits before the first push, not after.
3. Commit messages match the repository's recent history (`git log --oneline -20 origin/HEAD`). Add no trailers that point at local planning files, and add AI attribution only where that history carries it.
4. Base is the repository's default branch (`gh repo view <owner>/<repo> --json defaultBranchRef -q .defaultBranchRef.name`) unless the task names another. A branch stacked on an unmerged branch uses that branch as base.
5. Push with `git push -u origin <branch>`. Never force-push without asking. Once the PR is open, a review fix is a new commit: amending or squashing hides what changed since the last review and dismisses approvals.

## Title and body

- Title: follow the convention of recent merged PRs (`gh pr list --repo <owner>/<repo> --state merged --limit 10 --json title`). When they lead with an issue key (`ABC-123: ...`), use the key and summary of the issue this work is for, not its parent's; fetch the issue through an issue-tracker connection (such as Atlassian MCP) when one is available. Otherwise state what the change delivers.
- Read the repository's PR template and fill every heading in order: `pull_request_template.md` (any case) in `.github/`, the root or `docs/`, or the template in `.github/PULL_REQUEST_TEMPLATE/` that fits the change. Keep headings unchanged, and do not copy a template from memory. With no template, write a one-sentence summary, the review guidance below, then notes.
- The body tells a reviewer how to review the change. It does not restate the issue: behaviour the issue specifies is covered by its link. Keep the body under about 300 words, links aside. Place this content under the template's matching headings:
  - Links: the issue and its parent when there is one, and a design document when one exists.
  - Description: one sentence on what the change delivers, then at most four bullets a reviewer cannot get from the issue: contract changes (state explicitly when there is no database or API contract change), shared code changed outside the feature, removals, and scope left out.
  - What to review: the reading map below. Under about 500 changed lines, one to three bullets naming what to check instead.
  - Dependencies: when the template asks whether an install is needed, answer `No` unless dependencies changed, and say what changed in the package manifest.
  - Notes: companion PR links, then at most three caveats a reviewer or deployer needs: a known gap, a cost to weigh, a manual deploy step, a removed URL with no redirect.
- Leave out: merge-conflict forecasts for other branches, local verification recaps and test counts, local artifact paths, `@` mentions, and AI attribution unless recent merged PRs carry it.

Create with `gh pr create --repo <owner>/<repo> --base <base> --head <head> --title "<title>" --body-file <file>`. `<head>` is `<branch>`, or `<fork-owner>:<branch>` when you pushed to a fork.

## Reading map

Group every changed file (`git diff --numstat <base>...HEAD`) and list the groups in reading order, closest read first. Open with one line giving the total added lines and how many need a close read. Then one line per group, seven at most:

```
<n>. **<level>**: <files or classes> (<added lines, rounded>): <what to check>
```

| Level | Use for |
|---|---|
| Read closely | permission and tenant checks, queries, public contracts, schema and deploy scripts, money or data-loss paths, shared code other features call |
| Read one, skim the rest | sibling files of one shape; name the one to read |
| Check against the issue | declarative definitions, models, constants |
| Moved unchanged | code relocated without edits; name what proves it |
| Tests | what they cover, in one clause |

- "What to check" is a clause or two per group. A point that needs a paragraph is not description material; cut it.
- Name files or classes, never commit positions or SHAs, which go stale when the branch changes.
- Claim "one shape" or "moved unchanged" only after comparing the code.
- When a push moves files between groups, edit the live body (`gh pr view <n> --repo <owner>/<repo> --json body`), not the original file, so text review bots appended is kept.

## Paired PRs across repositories

A change that spans repositories gets one PR per repository, on the same branch name in each so reviewers can find the set. In a monorepo, one PR covers every layer.

1. When the client depends on a backend change, create the backend PR first, with a placeholder companion link in the notes.
2. Create the dependent PR, linking the backend PR.
3. Replace the placeholder with `gh pr edit <n> --repo <owner>/<repo> --body-file <file>`.
4. Confirm each with `gh pr view <n> --repo <owner>/<repo> --json url,baseRefName,headRefOid,mergeable`.

Report each PR URL, base, head SHA and mergeable state.
