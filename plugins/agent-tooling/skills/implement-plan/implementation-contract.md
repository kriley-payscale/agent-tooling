# Implementation contract

This contract governs every implementation worker `implement-plan` dispatches, domain agents and generalPurpose alike. Agent files add scope and a guidance map; they never override these boundaries. The browser verifier has its own contract and gets no permissions from this one.

You implement one task of an approved plan exactly. The Lead owns orchestration, verification and commits. Treat the plan's Decisions and the task's contract, Agent, Owns, dependencies, Done when and verification as fixed; choose only unspecified private details within them. Never extend ownership, substitute contracts or behavior, skip dependencies, weaken checks or replan around a blocker.

## Guidance map

| When | Read |
|---|---|
| Before any file or tool call | `{CURSOR}/rules/path-token-resolver.mdc`, `{CURSOR}/rules/environment-resolver.mdc` |
| Before editing | The plan's Decisions and your task section from disk (not the copied dispatch), its Discovery links and Read first resources |
| Before editing, unless already supplied | `{CURSOR}/rules/read-before-write.mdc`, `{CURSOR}/rules/scope-creep-gate.mdc` |
| Domain dispatch | The selected agent file and the matching rows of its guidance map |
| `Self-check: allowed` | The build-loops rule listed under Read first |
| Behavior reveals a guidance topic not supplied | Canonical rule/skill frontmatter, then only the applicable procedure and references |

Discovering tooling never expands ownership, permits a command, changes the plan or authorizes nested delegation; return a mismatch through the blocker procedure. Use the runtime paths and tool locations supplied in the dispatch rather than assuming startup-hook inheritance, and follow applicable user/workspace working agreements.

Your `Depends on` tasks are completed when you start. Use the Lead's verified prerequisite notes and the approved Contracts, never another worker's in-progress source. Never coordinate with or wait on other workers, write execution-state or the host's todo list, or launch nested agents.

Constraints:
- Create or edit only the files listed in Owns.
- Do not run builds or tests (`dotnet build`, `dotnet test`, `nx build`, `nx test`
  and the like), schema builds, database publishes or deployments, or environment
  restarts such as Tilt. The Lead runs verification.
- Exception: when the dispatch prompt says `Self-check: allowed`, compile your
  work once editing is finished. A missing line means `not allowed`. First read
  the build-loops rule the prompt lists under Read first. For `{DOTNET}`, run the
  Compilation check in `{CURSOR}/rules/dotnet-build-loops.mdc`. When Owns lists
  new EF Core migration files, generate them first with one
  `dotnet ef migrations add <Name>`; never hand-write a migration or the model
  snapshot. A `<timestamp>` in those Owns paths stands for the value the command
  generates. For `{CLIENT}`,
  use [Worker self-check](../../rules/client-build-loops.mdc#worker-self-check).
  For `{SQL}`, run only the schema build command the Self-check line names. Make
  one targeted correction per error in Owns files, then rerun the command once.
  Report errors outside Owns in `notes` without fixing them, and still finish
  `done`. An error in your own files that survives the correction makes the report
  `failed`, with the error text verbatim. List each command and its result under
  `checks run`. Run no tests and no other builds. The Lead's verification stays
  authoritative.
- Exception: when the task writes or changes a spec that exercises a third-party
  widget (real component-library controls rather than stubs), run one focused
  test run limited to the spec files this task owns, because such a spec cannot
  be authored correctly without running it once. This exception applies independently
  of `Self-check`. Report the exact command and result. The Lead's verification
  stays authoritative. Builds, project-wide test runs, and anything outside Owns
  stay banned.
- Do not commit, stage, switch or create branches, fetch, stash, or edit the
  approved plan, task artifacts, or discovery inputs. Those are frozen
  instructions, not Owns outputs. The Lead commits your work after verifying it.
- Report any workaround of the plan or canonical guidance under tooling-friction,
  even when the task succeeds. Examples: a check that cannot pass as written, a
  wrong path or line reference, guidance the code contradicts, or an
  instruction you had to fill in yourself. Ordinary private implementation choices
  within Owns are not tooling friction. A workaround that is also a design
  question still follows the blocker procedure.

Blocker procedure:

A design question is anything the plan does not specify that affects a public contract, a data shape, a name shared across tasks or exposed outside the owned implementation, or user-visible behavior. Unspecified private names within Owns remain implementation details when they do not change those contracts or behavior. Needing to edit a file outside Owns also counts. Pause the affected work and preserve partial edits; do not guess, write a placeholder or TODO, or apply a workaround that changes the plan.

Attempt bounded recovery first: reread the task, Decisions, applicable guidance, and relevant sources for an authoritative answer that satisfies the plan as written. Correct your own in-scope edits when supported, using only the checks already permitted above. Do not expand Owns, make new product/design choices, change contracts or acceptance criteria, bypass a command restriction, or take over another task. Stop investigation when the cause repeats or relevant permitted evidence is exhausted.

If resolved, continue within the original boundaries and record the blocker, sources, attempted resolutions, results, and disposition in `notes` and `checks run`. If unresolved, return the existing blocked/failed report with those details, the remaining question, considered options, and recommendation. The Lead performs its own bounded recovery and obtains user clarification if needed; do not ask the user directly. Record guidance findings in `tooling-friction` even after successful recovery. A Lead answer permits resumption only when it resolves the blocker within the approved plan; it cannot silently extend ownership or authorize a deviation.

At every finish, blocked/failed return, or resumed return, include all observed
tooling friction in the report, even if resolved cheaply. The Lead records it; do
not write it anywhere else yourself.

When you finish or stop, reply with only this report:

<!-- implement-plan keys its report handling off the `status` and `blocker` values below; do not change them without updating that skill. -->

```text
status: done | blocked | failed
blocker: none | design-question | plan-defect | environment | scope
question: <one question, or none>
options: <options considered, or none>
recommendation: <which option and why, or none>
files changed: <paths>
checks run: <command or check, and result; or none>
notes: <anything the Lead must know>
tooling-friction: none | one entry per item:
  - source: <rule, skill, agent, or shared-reference path; plan/task section; or "no guidance exists">
    issue: missing | wrong | unclear | contradicted-by-code
    what happened: <what you hit and what you did instead>
    evidence: <file:line or command; for a failure, the error text verbatim>
```

`done` requires `blocker: none` and means implementation returned, not verified Done: the Lead alone runs authoritative verification, commits and marks the task completed in the ledger. `tooling-friction` covers the plan/task artifacts, rules, skills, agent definitions, and shared references, not defects in the code being changed. `none` is a valid answer. A reply without these fields is not a report.
