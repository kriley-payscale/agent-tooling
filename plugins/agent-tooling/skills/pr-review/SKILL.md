---
name: pr-review
description: Reviews GitHub pull requests (a URL or owner/repo#n) in Angular, ASP.NET Core and SQL Server codebases for verified defects and convention violations, proven with builds, tests, read-only SQL and authenticated API calls. Use when asked to review a PR; each PR in a multi-repository set gets its own independent review.
disable-model-invocation: true
---

# PR Review

Review one or more GitHub PRs that change the workspace's client, .NET or SQL layers, and report only defects the evidence supports.

This skill reviews; it does not fix. Do not edit the main checkouts, push, comment on GitHub, deploy schema changes, apply migrations, or write to the database directly. A runtime check through the API that would write data needs the user's approval first ([verification.md](verification.md)).

## Guidance map

| When | Read |
|---|---|
| Step 1, the PR has a sibling PR or a contract with another repository; step 5, the PR changes or consumes a contract between layers, or a query predicate, join or order key | [defect-hunts-cross-repo.md](defect-hunts-cross-repo.md) |
| Step 2, creating the worktree and building or testing in it; step 10, removing it | [worktrees.md](worktrees.md) |
| Step 4, the PR changes .NET code or projects | [routing-dotnet.md](routing-dotnet.md) |
| Step 4, the PR changes client code | [routing-client.md](routing-client.md) |
| Step 4, the PR changes schema, migrations or data scripts | [routing-sql.md](routing-sql.md) |
| Step 4, the PR changes Tilt files under `{TILT}` | rule `tilt-conventions`, rule `tilt-dotnet-live-update` |
| Before creating or modifying files | rule `read-before-write` |
| Before scoping multi-root repository searches | rule `environment-resolver` |
| The PR changes database schema, EF entity mappings, database initialization or migration tooling | rule `dotnet-entity-naming` |
| Step 5, before running any hunt file | [defect-hunts.md](defect-hunts.md) |
| Step 5, the PR changes client code | [defect-hunts-client.md](defect-hunts-client.md) |
| Step 5, the PR changes .NET queries, EF or data access, or a SQL view, procedure or function | [defect-hunts-dotnet-queries.md](defect-hunts-dotnet-queries.md) |
| Step 5, the PR changes .NET services, tenancy, authorization, endpoints or locking, or a SQL view, procedure or function | [defect-hunts-dotnet-service.md](defect-hunts-dotnet-service.md) |
| Step 5, the PR changes schema, migrations or data scripts | [defect-hunts-sql.md](defect-hunts-sql.md) |
| Step 6, before using a verification level; the PR changes client layout | [verification.md](verification.md) |
| Step 8, after every independent finding has its `PCR-` ID | [bugbot-reconciliation.md](bugbot-reconciliation.md) |
| Step 9, writing the review file | [output-template.md](output-template.md) |

## Evidence boundary

The only authorities are:

- code at the reviewed head SHA, and the integration branch for examples
- code at a sibling PR's head SHA, for contract checks only
- canonical rules and skills under `{CURSOR}/rules` and `{CURSOR}/skills`
- the local database, read-only
- the running local API and, for rendered client behavior, the locally served app

`<integration>` in this skill's files is the integration branch: the repository's default branch, `<remote>/HEAD` with step 1's `<remote>` (`git remote set-head <remote> --auto` creates it), unless the PR's base is another long-lived branch such as `develop` or a release branch. A stacked PR's feature-branch base does not count.

Never read, compare against, or cite feature planning or review artifacts: plans, specs and design documents (such as `data-model.md`), planning-tool state directories, tickets other than the issue the PR links, `code-reviews/` folders, earlier files under `{ARTIFACTS}/code-review/`, or any other prior review document. This holds even when a PR body links to one. Search only with shell `git grep` or `grep` scoped to a worktree, a commit, or a single file. Do not use the Grep tool during a review: it searches every workspace root and pulls in forbidden files.

Two exceptions, neither of which is evidence that the code is correct:

- The PR title and body, and the issue the PR links, may be read for intent. When intent and code disagree, ask the author.
- Unresolved review-bot threads on the PR under review (for example from Cursor Bugbot) are leads. Read them only in step 8, after the independent findings are final; each one must earn its classification the same way any other candidate would. Replies in a thread may be read for intent. Do not follow links in a thread body, such as "Fix in Cursor".

## Workflow

Each PR gets its own review, with its own checklist and worktree, run one after another or as one subagent per PR. A review reports findings only in its own PR's code; a related PR in another repository is a contract reference for it (step 1), whether or not that PR is also being reviewed. Run a second review of the same PR only when the user asks.

Copy this checklist for each PR and keep it current. Each numbered section below is one step.

```
- [ ] 1. Inputs and PR pairing
- [ ] 2. Worktree at the pinned head SHA
- [ ] 3. Diff boundary
- [ ] 4. Routing: rules and skills loaded
- [ ] 5. Defect hunts per layer and across layers
- [ ] 6. Verification ladder per candidate
- [ ] 7. Severity capped by evidence and reachability
- [ ] 8. Review-bot reconciliation (unresolved threads only)
- [ ] 9. Review added to the session's file and summarized in chat
- [ ] 10. Worktrees and scratch branches removed
```

## 1. Inputs and PR pairing

Input: one or more PRs, each a URL or `<owner>/<repo>#<n>`. Optional for each: a pinned head SHA and a path filter. Run every step for each PR.

```bash
gh pr view <n> --repo <owner>/<repo> --json number,title,body,baseRefName,headRefName,headRefOid,files,url
```

- The head SHA is the pinned SHA if given; otherwise `headRefOid`.
- A path filter limits findings to matching files. Callers and consumers outside the filter may still be read to prove a finding.
- `<checkout>` is the root (`git rev-parse --show-toplevel`) of the role folder (`{CLIENT}`, `{DOTNET}`, `{SQL}`, `{TILT}`) with a remote (`git remote -v`) naming `<owner>/<repo>`, whose name is `<remote>` (in a fork, not `origin`). If none matches, report it and stop; do not clone.
- The PR's layers are the role folders its changed files fall under; one repository can hold several. A file outside every role folder, or in a shared one, goes by its kind (`*.cs` .NET, `*.ts` client, `*.sql` schema). EF Core `Migrations/**` count as .NET and schema.

Find sibling PRs in the workspace's other repositories, in this order:

1. the other PRs and links the user supplied
2. links in the PR body to PRs in other repositories
3. the same head branch in each other workspace repository: `gh pr list --repo <other-owner>/<other-repo> --head <headRefName> --state open --json number,title,headRefName,url`
4. the issue key in the title or branch: that command with `--search "<KEY>"` for `--head`

When the PR has a sibling PR or a contract with another repository, follow "Contract reference" in [defect-hunts-cross-repo.md](defect-hunts-cross-repo.md).

## 2. Worktree

Never check out a PR in the main checkouts under `{WORKSPACE}`. Watchers and dev servers (Tilt, `dotnet watch`, `nx serve`) may serve them, and they hold the user's own work.

Follow "Create" in [worktrees.md](worktrees.md), then its section for each layer the PR touches. Never commit to a PR head branch, never set an upstream, and never push.

## 3. Diff boundary

```bash
base=$(git -C <checkout> merge-base <remote>/<baseRefName> <head-sha>)
git -C <checkout> diff --name-status "$base" <head-sha> -- <path filter>
git -C <checkout> diff "$base" <head-sha> -- <file>
```

Classify every candidate:

- **Introduced:** the PR adds or changes the defective lines, or changes behavior so that existing lines become defective.
- **Pre-existing:** the defect is present at `$base` and the PR does not make it worse. Confirm with `git blame <base> -- <file>`. List these under "Observed, not introduced", never under Findings.

## 4. Routing

Read the routing table for each layer the PR touches: [routing-dotnet.md](routing-dotnet.md), [routing-client.md](routing-client.md) or [routing-sql.md](routing-sql.md). Table paths are relative to the layer's role folder; drop its prefix in the repository (`git -C <folder> rev-parse --show-prefix`) before matching.

- Match every changed path and behavior against the table before judging the file. A path can match several rows; load the union of their rules and skills.
- Read each listed rule or skill in full, honoring any named section scope. Follow a skill's router to read only its applicable topic references.
- Load each rule the Guidance map names when its condition holds.
- Include the applicable rules in subagent context; do not assume they are automatically loaded.

Never skip a routed rule to save budget. If a rule cannot be loaded, list it under Review Limitations and treat that layer's review as incomplete.

## 5. Defect hunts

Read [defect-hunts.md](defect-hunts.md), then the hunt file the Guidance map selects for each layer the PR touches, and run the hunts they select.

Trace callers and consumers far enough to prove the trigger and the impact. A hunt that finds nothing produces nothing; do not list clean hunts as findings.

## 6. Verification ladder

| Level | Evidence |
|---|---|
| L0 Static | Traced through callers and consumers at the head SHA |
| L1 Pattern | The governing rule plus a compliant example at path and symbol |
| L2 Data | Read-only `SELECT`s on the local database proving uniqueness, reachability, or truncation |
| L3 Test | A characterization test that fails at the head SHA, or an impacted existing test run |
| L4 Runtime | An authenticated API call, or a browser pass for rendered client behavior |

Read the section in [verification.md](verification.md) for each level before using it. Never switch the main checkout to make a runtime check possible.

When the PR changes client layout, run the browser pass in that file even with no candidate to settle. Code and specs do not show how a view renders.

## 7. Severity

### Cap

- A data-dependent claim (cardinality, reachability, truncation) cannot be High without L2.
- Nothing is Critical without L3 or L4.
- A performance claim cannot be High without an L2 count at realistic size (name the tenant or population and the row counts) or an L4 profile from `dotnet-endpoint-profiling`. Statement counts from L0 tracing show the shape, not the cost.
- When data reachable on the code path cannot trigger the defect, downgrade it, and state that the local database is not production data.
- An unproven concern is not a finding. Put it under Review Limitations with the check that would settle it.

### Scale

- **Critical:** data corruption, a security breach, or an outage that is likely under normal use.
- **High:** wrong results, an authorization gap, or a hard failure that reachable data triggers; or a performance defect that scales with tenant or data size on a hot path.
- **Medium:** a standards violation or latent defect with bounded impact, or a misleading contract.
- **Low:** maintainability, consistency, or defense in depth.

## 8. Review-bot reconciliation

Assign `PCR-` IDs to every independent finding first. Then follow [bugbot-reconciliation.md](bugbot-reconciliation.md). A thread never edits, re-ranks, or re-rates an existing finding; it can only link to one.

## 9. Output

Write one file for the session, however many PRs it reviews:

```
{ARTIFACTS}/code-review/{repo-dir}/{PR-Name}/review-<YYYY-MM-DD-HHMM>.md
```

Never overwrite another session's file. [output-template.md](output-template.md) gives the naming rules, when to append each PR's review, the heading order and the finding format.

In chat, return one line per PR (the PR and its severity counts), then the path of the file written. Do not paste the review.

## 10. Cleanup

Follow "Cleanup" in [worktrees.md](worktrees.md) for every worktree.

## Readability pass

Run only when the user asks. Report it in its own section, capped at Medium, and never mix it into the correctness findings.
