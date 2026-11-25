# Plan readiness checks

Evaluate each worker handoff as though it has none of the planning conversation. A
failed check blocks the affected task; a confident report or percentage is not proof
of readiness.

## Schema, ownership and graph

- Every task has all eleven fields, valid task-id/heading metadata, ordinal order,
  resolvable references and discovery links, and existing fragment-free plan file
  links. Its Agent matches its Owns under the shared rule's Domain map, and its Read
  first is consistent with that domain's guidance map and with Decisions.
- Owns is exclusive under the schema rule's definition. When a task changes the
  signature or behavior of a shared function (formatter, helper, constructor),
  search the repository for callers now: every caller that must pass the new input
  is in some task's Owns, or the plan states it keeps the default. A `Done when`
  spanning several surfaces names each surface's file.
- Every task's `Depends on` and `Completion depends on` edges, and the final
  orchestrator task's, meet rule `plan-task-schema`.
- Producer/consumer contracts are settled. A missing consequential contract blocks
  readiness.
- The implementer's stop conditions are reachable from its handoff, and
  verification is feasible from what the Lead will have.

## Scheduling, commits and branches

- The plan runs under the implementation skill's scheduling: one active worker per
  repository, Lead checks that wait for that repository's worker, and every shared
  runtime named in Resources. The ledger is in no task's Owns.
- Decisions record task-commit approval for user review; Resources names each
  repository a task commits to. Each task's H1 is stable and follows that
  repository's commit subject convention, because its text without `# ` is the
  commit subject. Non-Git outputs say so, with no Git initialization or
  fallback repository. Verification/no-change tasks never require empty commits.
- Each implementation repository has one approved feature branch and base from
  Workspace Git readiness, shared by every task in that repository. Unresolved selection
  blocks readiness. Deferred creation does not: the Lead creates the branch before
  any worker starts.
- This run's changes are identified by diffing against the researched HEAD and each
  task's pre-dispatch status. Pre-existing or concurrent work is preserved and
  accounted for; accepting it at entry must not conflict with a later absolute
  cleanliness assertion. Require a clean checkout only as an explicit prerequisite.

## User-flow coverage

- Every required UF ID maps to its implementation task(s) and exact final steps:
  actor/permission/preconditions, expected results, runtime prerequisites, evidence
  and cleanup, using the existing Discovery/Done when/Verification fields. Unmapped
  flows and unsettled behavior block readiness.
- New UI flows meet the discovery skill's flow template completely. An actor no
  configured credential keys sign in as needs per-actor keys, or the application's
  impersonation feature with how to start it and prove the resulting identity;
  without either the flow is not ready.
- When the client has a design system, new or restyled UI states in Decisions
  whether it renders inside the design system's context. It names the design-system
  component, class, mixin or token family each new visual element uses, per
  `{CURSOR}/skills/client-angular-component/styles.md`, or names the design-system
  gap that requires custom SCSS.
- A plan that adds or changes UI behavior has a browser section covering every UF ID
  with a UI step. Read
  `{CURSOR}/agents/verification-agent.md` as the helper contract, check
  the final task's browser section against the schema rule, and define how the Lead
  reconciles each required flow with raw evidence. No source-only check substitutes
  for required native behavior.

## Authenticated API checks

When verification needs authenticated local API calls, run the credential
preparation of skill `api-auth` in `{CURSOR}/skills/api-auth/credential-setup.md`
now, before plan handoff. That skill owns required-role checks, non-overwriting
template creation at `~/.agent-tooling/credentials`, user prompting and login
validation. Writable planning permits this credential setup; explicit read-only
planning forbids it. Continue independent planning while the user edits the file.
Record only the preparation/validation disposition, never credentials or cookies.
If runtime validation is unavailable, record it as pending and make it a mandatory
Build-entry preflight; unvalidated credentials are not verified readiness.

## Verification commands

- Each proposed automated test names the regression it catches. Each task that
  changes tested behavior records what happens to the existing tests. A missing
  record blocks readiness.
- Each command has an explicit working directory, or states why it is
  cwd-independent. Dry-run searches exactly from that directory and confirm their
  input paths exist.
- For a negative `rg` check, exit 1 means no matches; exit 2 or higher is an error,
  never evidence of absence. Empty stdout alone is insufficient.
- A `Done when` that proves a removal with a search that must return nothing is
  dry-run now, with the exact command string the plan will contain:
  - Against the current tree it matches exactly the occurrences the task removes.
    If it also matches kept code, tighten the pattern or add an exclusion.
  - Against the expected rewritten text it matches nothing; a rewrite that keeps the
    searched substring fails on its own correct output.
  - `rg --glob '!dir/**'` excludes `dir` only at the search root; use
    `'!**/dir/**'` for a nested folder.
  - When moved text gets a factual correction, search every destination for the old
    claim and give each hit an owner.
- A rule or skill created during Build may not load in subagents dispatched from
  that Build session, and a check relying on it fails silently. Leave such a check to a
  fresh chat, or state that it cannot be verified during Build.
- Use executable names resolved through environment guidance, not
  installation-specific paths, and reference canonical credential procedures instead
  of embedding secrets.

## Baselines and captured output

- Every baseline comparison, including in final verification, resolves to a named
  capture taken before its first affecting edit. A diagnostic baseline shared by
  several tasks gets one baseline ID with its capture step, commands, cwd, output
  scope and evidence location; every later comparison references that ID and applies
  the same filter to original and current output. A later task's pre-edit
  diagnostics cannot replace it. A missing required baseline blocks the affected
  verification.
- Walk verification in execution order: authentication, read-only fixture
  selection and other inputs exist before the baseline that consumes them. Put setup
  that must precede dispatch in an explicit Build-entry preflight; never delay a
  capture or relax its timing to resolve a conflict.
- When verification compares captured output, specify the capture format on both
  sides and trace it through parsing, normalization and comparison. Without runtime
  access, dry-run pure transformations with representative synthetic output and
  assert the parsed values and result; syntax-checking a fragment is insufficient.
  Repeat the dry run after changing a capture format or pipeline.
- Give each distinct runtime reference a readable evidence filename or fixture alias
  mapped to its complete request parameters, including every distinguishing
  dimension (scenario, selection, currency); an entity ID alone is insufficient.
  Captures must not overwrite evidence another comparison still needs.

## Runtime fixtures

- For observational checks, trace automatic effects of navigation, page entry and
  invoked operations, including calculation or refresh paths that write. Require
  source-backed non-writing preconditions, or disposable fixtures with authorized
  setup and cleanup; otherwise the check is not ready. A checksum after the action
  detects a change; it neither prevents a write nor provides restoration data.
- For ordered checks, state each fixture and UI/query-state precondition and walk
  the cases in order, carrying writes, filters, sorting, selection and pagination
  forward. Reset between cases when retained state would invalidate a later
  expectation, or assert the combined result.
- Capture original preservation/restoration values before edits or writes. Missing
  original evidence requires supported recovery or a stop, never guessed values or a
  passing preservation claim. Compare whole-table baselines only after fixture
  cleanup, or restrict mid-run checks to the original row IDs.
- Track created fixture IDs, owner/tenant and intended state transitions, and
  specify cleanup on failures and stops using only those fixtures and known original
  values; do not rely on reaching the last verification step.
- When checks need existing runtime data to fill named fixture roles and the runtime
  is reachable during planning, run the read-only selection then and record the
  chosen IDs or the gap. Plan a reversible fixture for each role existing data cannot
  fill; Build entry only re-confirms the recorded IDs.

## Gaps

A missing consequential decision blocks the affected task and returns to discovery
for that gap. Distinguish a source-backed answer from a new choice for the user.
Record unavailable runtimes or verification capabilities honestly instead of
claiming checks passed. An explicitly requested investigation may be a scoped plan
task, but its dependent implementation is not ready while its design is unresolved.
