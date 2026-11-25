# Final end-to-end verification

Reports follow [handling-reports.md](handling-reports.md), commits follow [verify-and-commit.md](verify-and-commit.md), closing bookkeeping follows [completion-summary.md](completion-summary.md), and the ledger follows [SKILL.md](SKILL.md).

When the final Agent: orchestrator task is ready, the parent runs its exact planned checks against the integrated result, with no implementation writer active, and records evidence for each linked discovery acceptance requirement. Do not dispatch the final task or replace it with implementation-worker reports or stale partial checks. The parent runs nonbrowser build, unit, API and SQL checks. Only approved flows listed under `Browser verification: verification-agent` may use the browser verifier. Read the applicable SQL/API/client/runtime procedures before the operation; only the planned checks and existing permissions apply. The task edits no implementation or approved instruction files and makes no commit. Required runtime mutations must be explicitly planned and authorized, with their fixture/cleanup contracts intact. Unavailable required capability is a blocker, not a passing check.

Follow the frozen `discovery/user-flows.md` mapping: record every required UF ID's actual steps and outcomes, fixture restoration, the source revision checked and the contributing task commits. Technical build/test success alone does not cover a user journey. Record the exact missing prerequisite for any required flow or check that did not run.

Organize each attempt's evidence by user flow, under
`{ARTIFACTS}/planning/<plan-slug>/verification/<attempt>/`:

```text
<attempt>/
  attempt.md     index; see below
  prereq/        source/runtime identity and prerequisite results
  fixtures/      original values, applied fixtures, restore scripts, cleanup proof
  UF-<nnn>/      everything that proves this flow, browser or not
    assertions.md  expected vs actual per step and the flow verdict; header records
                   source/runtime identity, actor, and for browser flows the
                   verifier, slot and namespace
    *.png, raw/    screenshots and raw responses its assertions cite
    <check files>  this flow's API/SQL check output and expected-values queries
  checks/        cited evidence for acceptance checks mapped to no UF ID
```

Save a file only when an assertion or ledger entry cites it, a check failed, or it
holds fixture originals, fixture identities, restore scripts or cleanup proof.
Passing build, lint and unit-test runs live in the ledger as command, cwd, exit code
and summary line, with no log file. Expected-values queries save the query, its
summary, and the row output only when an assertion compares rows against it. A later
attempt cites unchanged files in the earlier attempt instead of copying them.

Attempts are numbered `attempt-1`, `attempt-2`, and so on. Only the Lead writes
`attempt.md`: a `Reason:` line (initial run, or the correction/commit or runtime
change that invalidated earlier results), a `Source:` line with each repository's
commit, and one row per required UF ID and acceptance check with its verdict
(`pass`, `fail`, `blocked`, `pending`) and the attempt holding its current valid
result. Rows still valid from an earlier attempt point there instead of rerunning.
Update it as results are reconciled, alongside the ledger.

Browser flows listed in the final task's browser section follow
[browser-verification.md](browser-verification.md) for admission, dispatch and
evidence reconciliation.

Every required check must pass and fixture restoration must succeed before
completion; a required check that did not run leaves this task and closing
bookkeeping incomplete, never an alternate Done outcome. Use [handling-reports.md](handling-reports.md) for
failures. An attributable defect returns to the owning worker within its existing
ownership and correction limits; rerun that task's verification, commit the
correction, then rerun the full final check set against the corrected tree.
Source/runtime changes invalidate earlier final results, including browser flows.
A contract/scope change or exhausted recovery stops the run for clarification.
Record final verification friction under its task id, complete only with fresh
evidence, then write the completion summary. No completion claim on an unresolved stop.
