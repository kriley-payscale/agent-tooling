---
name: implement-plan
description: Use when starting or resuming Build of an approved plan, dispatching and verifying workers, running final verification, or resolving blocked reports. Not discovery or plan authoring.
disable-model-invocation: true
---

# Implement the approved plan

At Build, the parent acts as Lead and main orchestrator. This skill owns
scheduling, Lead recovery, verification, task commits and completion. Do not reopen
discovery/planning merely because Build begins or take over worker implementation
edits.

## Guidance map

| When | Read |
|---|---|
| At the start of Build and on every resume, before any dispatch | [setup.md](setup.md), rule `plan-workflow`, rule `plan-task-schema` |
| Setup step 4, and when writing every dispatch | [implementation-contract.md](implementation-contract.md), the selected `{CURSOR}/agents/<Agent>.md` files |
| Approved deferred branch creation, for its step 3 | `{CURSOR}/skills/discovery/workspace-git-readiness.md` |
| Before the first command in `{DOTNET}` | rule `dotnet-build-loops` |
| Before the first command in `{CLIENT}` | rule `client-build-loops` |
| Before the first database check | skill `sql-query` |
| A task is implemented and every `Completion depends on` task is completed | [verify-and-commit.md](verify-and-commit.md) |
| A report is not `done` with `blocker: none`, a required check fails, or Build must stop | [handling-reports.md](handling-reports.md) |
| The final task is ready | [final-verification.md](final-verification.md) |
| The final task has a browser section | [browser-verification.md](browser-verification.md) |
| The event loop completes, or Build stops on an unresolved blocker | [completion-summary.md](completion-summary.md) |

## When this runs

When the user asks to build an approved plan, or to resume one. Read it once at the start or resumption of Build; it governs every task in the plan, including final verification. A stopped Build leaves unfinished tasks pending in the ledger. Before any dispatch, at the start and on every resume, run [setup.md](setup.md).

An implementation worker returns questions through its report. The Lead answers by resuming that same worker so it keeps its context. If the host can't resume a worker, report that instead of starting a new one. Workers run on the parent's model unless the user names another; set no other per-task model or automatic escalation.

## Scheduling

The Lead runs an event loop: admit ready work, process each report as it arrives,
verify, commit, repeat. Workstream names and ordinals are display groups, never
barriers. One runtime worker runs per active task; several tasks may use the same
domain instruction file.

### Admission

A task is ready when every `Depends on` task is completed. A task occupies every
repository its Owns touch; a non-Git output directory counts as one repository.

- Run at most one active worker (starting, running or cancellation-unconfirmed)
  per repository. Workers in different repositories run in parallel, so the ceiling
  is the number of repositories; a tighter host limit wins. A returned worker frees
  its repository.
- When a repository is free, dispatch its first ready task in plan order.
  Resumes follow the same rule.
- A returned task whose verification is ready is verified and committed before
  that repository's next dispatch. A task still waiting on `Completion depends on`
  does not hold its repository.

One worker per repository also keeps client TypeScript/Nx processes from running
concurrently and exhausting memory.

Launch with native background execution, or an equivalent that leaves the Lead able
to process reports. Record the agent id on confirmed launch. An uncertain launch or
cancellation keeps its repository occupied until confirmed. If delegation is unavailable, report
the limitation instead of claiming a dispatch.

### Checks and shared runtimes

- Run a Lead build, test or commit in a repository only while no worker is active
  there. Run the Lead's client checks one at a time.
- Run one operation at a time against a shared runtime (database deployment or
  fixture writes, Tilt restart, the running API), never while another check depends
  on that runtime. Resources names the runtimes a task's checks use.
- External editors and watchers are outside this coordination: detect them,
  preserve their edits, defer conflicting checks, and treat a result as stale if
  its source changed during the run. Never kill watchers.
- Set each dispatch's `Self-check` to `allowed` for `{DOTNET}` and `{CLIENT}` tasks,
  since the worker is the only writer in its repository, and add
  `{CURSOR}/rules/dotnet-build-loops.mdc` and/or the Worker self-check section of
  `{CURSOR}/rules/client-build-loops.mdc` to the prompt's Read first. `{SQL}` tasks
  are `not allowed` unless the repository has a schema build that the task's
  Verification uses; then allow it and name that one command on the Self-check line.

### Baselines and snapshots

- Run every `Verification (Lead runs)` step that records a pre-change baseline
  (type-check, timing, row count) before the earliest dispatch that can affect it,
  even when the plan does not say "before dispatch". Record its command, cwd and
  output scope; reuse it on resume and never recapture it after edits. Missing
  original evidence follows the unresolved-blocker stop.
- Before dispatching a task, record `git status --short` for its repositories so its
  edits can be told apart from existing work. Copy existing non-Git Owns files to a
  temporary snapshot directory and note which Owns files do not exist yet.
- Before dispatching an alternative implementation of an already verified task (a
  pre-approved fallback, or an experiment that may be rolled back), copy its
  verified Owns files to a snapshot directory. Prove a rollback with `cmp` against
  the snapshot (on Windows `fc.exe /b <a> <b>`; plain `fc` is `Format-Custom`). An
  agent re-creating the earlier version or matching rebuilt assembly hashes proves
  nothing. If the restore cannot be proven byte-identical, rerun the task's full
  Verification before marking it complete.

### Execution ledger

Only the Lead writes `{ARTIFACTS}/planning/<plan-slug>/execution-state.md`. The
ledger is excluded from frozen inputs and every Owns. Record:

- per task: Agent, agent id, state (`pending`, `running`, `implemented`, `verified`,
  `completed`, `blocked`, `failed`), recovery attempts and outstanding gates;
- the active worker in each repository;
- baselines (id, command, cwd, evidence location);
- verification results with the source state they ran against, and invalidations;
- commit SHAs per task and repository; Build decisions.

Persist launches, reports, verification, commits and invalidations as they happen.
A task is completed only after Lead verification and commit (or a verified
no-change/non-Git disposition); a worker's `done` is never verified Done. The Lead may
mirror task states in the host's todo list but never reads them back.

### Event loop

1. Process each report as it arrives: record the report and any tooling friction,
   confirm the worker returned and free its repository. Do not wait for unrelated
   reports. `done` with `blocker: none` marks the task implemented; any other report
   follows [handling-reports.md](handling-reports.md).
2. Queue verification when a task is implemented and every `Completion depends on`
   task is completed. Run Per-task verification, then Task commits, from
   [verify-and-commit.md](verify-and-commit.md); on pass, mark it completed and pass its evidence and commit SHAs to dependents' dispatches.
3. Admit ready work under Admission.
4. Repeat as reports and checks finish. If all remaining work waits, record what
   each task waits on and wait for real resolution; no polling, scripts or
   dependency bypass.
5. Final verification becomes ready once every other task is completed; run it per [final-verification.md](final-verification.md).
6. When the event loop completes, or Build stops on an unresolved blocker, report per [completion-summary.md](completion-summary.md).

## Dispatch prompt

- Dispatch every task to the host's general-purpose worker with the shared implementation contract.
- For a domain Agent, also supply its `{CURSOR}/agents/<Agent>.md` as explicit standing instructions; for `Agent: generalPurpose`, supply none. A domain Agent selects an instruction file, not a worker type, so dispatch works whether or not the host registers the plugin's agents.
- Each dispatch must stand alone regardless of conversation inheritance.
- Pass the ready `AGENT_TOOLING_RUNTIME` snapshot (status, resolved `{CURSOR}`, `{WORKSPACE}`, `{ARTIFACTS}` and role paths, configured tool paths) in every dispatch, with tokens resolved to absolute paths.
- When a task's `Owns` includes a tooling file (rule, skill, agent, manifest), state that file content keeps `{CURSOR}`-style tokens and never gets an absolute path, because an agent copies the resolved path it was given into the file.

```text
Shared execution contract: {CURSOR}/skills/implement-plan/implementation-contract.md
Selected agent instructions: <absolute domain agent path, or none for generalPurpose>
Read the shared contract completely first, then the selected domain agent file if
one is supplied. The shared contract owns permissions and the exact return report;
domain guidance cannot override it.

Task section (verbatim from the numbered artifact):
<task section>

Task artifact: <absolute task file and heading>
Plan: <absolute plan file path>
Expected repositories: <repository, approved feature branch and base SHA>
Verified prerequisites: <task ids with evidence and commit SHAs, or none>
Self-check: <allowed | not allowed | allowed: schema build command>

Decisions (fixed, do not revisit):
<Decisions section>

Decisions made during Build:
<Build decisions log, or "none">

Read first:
<the task's Read first paths>
```

The shared contract defines the exact report. A reply missing required fields is not a report: resume the same agent once asking for it. If still missing, treat the task as failed.

## Build decisions log

Keep the log in the conversation across this Build's stops and resumes, and persist decisions and evidence references in the execution ledger so they survive context loss. Each entry records the task id, the question, the answer, who decided (Lead or user), and the source. A Lead answer records an established decision; the log cannot authorize a deviation. Include the full log in every later dispatch and every resume. Do not write it into the plan file.

## Tooling friction

Tooling friction is friction with the plan or task artifacts, rules, skills, agent
definitions or shared references, not defects in the code being changed. Collect each
report's `tooling-friction` entries (including blocked and resumed reports), the
Lead's own friction (plan defects, checks that could not pass as written, build-loop
situations no rule covered, workarounds visible in a diff that the report did not
list) and recovery findings. Read the worker's transcript, where the host keeps one,
only when a task failed, was resumed, or its diff shows a workaround its report did
not list.

Record each item in the ledger under `build-entry` or its task id as it appears, and
list them all in the completion summary so they stay visible in the conversation. Do
not send friction to workers or write it into the frozen artifacts. Reports never
prove verification passed.
