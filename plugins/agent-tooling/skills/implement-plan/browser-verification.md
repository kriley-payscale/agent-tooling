# Browser verification

The Lead admits verifiers, reconciles their evidence and owns completion; verifiers follow
`{CURSOR}/agents/verification-agent.md`, not the implementation contract.

## Admission

Read the approved final-task browser section and linked UF definitions; do not
invent flows or revise their assertions. Default to one verifier. Run at most two
starting, running or cancellation-unconfirmed verifiers, limited further by actual
host capacity and demonstrated browser isolation. Same-account overlap also requires
demonstrated concurrent-session support for that account; separate accounts still
need independent fixtures. Unknown independence or shared mutable state serializes.
Group independent journeys, not pages: keep related checks and dependent cross-page
journeys with one owner.

Before launch, give each flow one owner, one exclusive named slot, and the fixtures
and session it may affect. Slot 1 is `playwright`; slot 2 is `playwright-verifier-2`.
Resolve and pass the exact available tool namespace for that server; never infer a
separate session from tabs or callers. Both namespaces may be visible to both agents,
so exclusive use is a protocol to verify, not an enforced tool boundary. Queue excess
ready assignments; queueing consumes no correction budget. A verifier with
unresolved cleanup or unconfirmed cancellation keeps its slot and fixtures until
confirmed.

Dispatch admitted independent assignments together as simultaneous foreground
workers, on the parent's model unless the user names another. No
implementation writer runs during browser verification. Supply each invocation standalone:

```text
Selected verifier instructions: {CURSOR}/agents/verification-agent.md
Use this verifier's contract, not the implementation-worker contract.
Assignment/attempt: <unique IDs>
Plan/final task: <approved absolute paths and heading>
Approved flows: <links, UF IDs and grouping/order from the final task>
Decisions and Build decisions log: <fixed approved context>
Runtime: <ready AGENT_TOOLING_RUNTIME snapshot with resolved paths and tools>
Source/runtime identity: <stable final source version and running application identity>
Browser: <exclusive slot, server and exact tool namespace>
User/tenant/origin: <planned credential aliases; when the actor isn't a configured account, the user and tenant to impersonate and the app's impersonation steps; starting state>
Credentials: <assigned secret KEY aliases, never values>
Evidence: <unique {ARTIFACTS}/planning/<plan-slug>/verification/<attempt>/<UF-ID>/ per flow>
Fixtures/effects/cleanup: <approved resources, original values, permitted actions,
  restoration on every exit and browser close requirements>
```

Resolve path tokens before dispatch, and supply the verifier's agent file as
explicit instructions, as for implementation workers. Verification runs only through
Playwright MCP, in the verifier's assigned slot; missing delegation, Playwright
tools, credentials, identity proof or another required capability blocks the
affected checks. To prove a newly built agent loads and behaves natively, reload the
tooling and use a fresh session. A self-modifying Build retains its original
contracts throughout; candidate-agent acceptance does not delegate that Build's final
completion.

## Reconcile evidence and recover

Require the verifier's exact report with overall/per-flow passed, failed or
blocked results, actual assertions, evidence identities, diagnostics, cleanup and
tooling friction. For a missing/malformed report, request the correct report once
from the same verifier; repeated failure follows the existing stop boundary, with
no new implementation retry allowance. Record each report's friction under the
final task's id with its assignment, attempt and UF IDs.

Inspect the referenced raw assertion/tool evidence and actual files, not just
summaries or screenshots. Match expected versus observed results, exact assigned
namespace, attempt/source/runtime identity and evidence scope. Reconcile every
required UF exactly once for the current attempt and confirm required cleanup and
browser termination. Missing/duplicate flows, wrong-slot evidence, absent files,
stale or drifting source/runtime, unconfirmed stop, unresolved cleanup and required
not-run assertions prevent closure. An observed expectation mismatch is failed;
an unavailable prerequisite/capability or incomplete evidence is blocked. A
verifier's passed report is insufficient until these checks pass; successful
delegation does not require repeating every successful browser interaction.

Wait for every verifier to return or be confirmed stopped with cleanup before
dispatching fixes, source-affecting commands/builds/publishes, runtime restarts or
global state/flag changes. On a stop, use supported cancellation and the planned
cleanup boundary; unknown cancellation does not free a slot or permit fixes. Retain
evidence and pending state when cleanup cannot finish safely.

Failures, corrections and completion follow [final-verification.md](final-verification.md); source/runtime changes need fresh attempts and evidence paths
for affected browser flows.
