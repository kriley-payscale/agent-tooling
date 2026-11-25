# pr-review — output

## File

- One PR: `{repo-dir}` is the repository's `<repo-dir>` in [worktrees.md](worktrees.md).
- Several PRs: `{repo-dir}` is `multi`, and `{PR-Name}` comes from the first PR supplied.
- `{PR-Name}`: the PR title lowercased, with every run of characters other than `a-z` and `0-9` replaced by one hyphen, and leading and trailing hyphens trimmed. For example, `Add CSV export to the widget list` becomes `add-csv-export-to-the-widget-list`.
- The timestamp is the local time the file is first written (`date +%Y-%m-%d-%H%M`). Create folders as needed.
- With several PRs, the file holds each PR's review in full, one after another, each starting at its own `# PR Review:` heading. Append a review when it finishes instead of holding them all until the end. A subagent returns its PR's review and does not write the file; the session that started it appends.

## Content rules

- Every finding is located in this PR's code. A contract mismatch whose fix belongs in a sibling PR or another repository goes in Cross-Layer Contract Checks, not under Findings.
- Link sibling PRs by their GitHub URL, not by a review file.
- Order findings by severity, then by path, within each PR's review. Number findings by the order the PRs were supplied: the first PR's from `PCR-001`, the second's from `PCR-101`, the third's from `PCR-201`, and so on, so an ID is unique in the file.
- Use repository-relative paths in findings; never machine-absolute paths.

## Template

Use this heading order. Empty sections contain `None.`

```markdown
# PR Review: <owner>/<repo>#<n> — <PR title>

## Review Metadata
- PR: <url> @ `<head-sha>` (base `<baseRefName>` @ `<base-sha>`)
- Path filter: <filter or `None.`>
- Layers: <client, .NET, schema, Tilt>
- Sibling PRs: <GitHub links, or `None.`>
- Pairing source: <user links | PR body links | same branch name | issue key <KEY> | none found>
- Worktree: <built / tests run / not run and why>
- Rules and skills loaded: <names>
- Highest verification level: <L0–L4>; runtime <available | unavailable: reason>; browser pass <run | not due | not run: reason>
- Review bots: <n> unresolved threads — matched <a>, confirmed <b>, rejected <c>, superseded <d>, needs author decision <e>
- Reviewed at: <ISO-8601 timestamp>

## Summary
Critical <n> | High <n> | Medium <n> | Low <n>

## Findings

### PCR-001 — <severity> — <title>
- Location: `<repo>:<path>:<line-range> @ <short-sha>`
- Introduced by this PR: yes | partly (explain)
- Evidence: <what the code does at the head SHA>
- Expected: <required behavior>; governing rule: `<rule or skill>` (<section>) | none canonical: <where the expected behavior comes from>
- Example: `<path>` `<symbol>` on <integration branch> | none; rule only
- Impact and trigger: <what goes wrong, for which data or user action>
- Verification: <level> — `<command>` → <result>

## Cross-Layer Contract Checks
| Check | Layers | Result |
|---|---|---|
| <e.g. DTO WidgetDto.Name vs model widget.name> | .NET, client | match / mismatch (PCR-00n) / mismatch: change needed in <owner>/<repo>#<m> / not checked: reason |

## Review-Bot Reconciliation
| Thread | Bot and title | Classification | Evidence | Finding |
|---|---|---|---|---|
| <thread url> | <login>: <title> | matched / confirmed / rejected / superseded / needs author decision | <level and one-line proof> | PCR-00n / — |

## Observed, Not Introduced
- `<path>:<line>` — <issue> (present at `<base-sha>`)

## Questions for the Author
- <intent the code cannot answer>

## Review Limitations
- <missing capability or evidence, and the check that would settle it>
```
