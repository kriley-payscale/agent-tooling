# Chained and Target-Scoped Async Workflows

Keep the request, reducer, effect, counting slices and terminal actions in one trace; an operator choice alone does not establish correctness.

## Chained transitions and load ownership

When inserting an async operation before an existing load, inspect every downstream request, success and failure transition for whole-slice replacement such as `() => initialState`. Preserve upstream pending or terminal state while the UI still consumes it. Trace both failure paths as well as success.

Give each dependent load one owner. Do not dispatch the same load from both an effect and a component, or from two effects reacting to the same success. When a guard needs this state loaded before activation, skill `client-angular-route` owns the hydration.

Focused reducer coverage must span the upstream trigger/result and downstream load/result; effects ordering alone does not prove state survives hydration.

## Request identity and acceptance

1. Identify the scope (a parent entity such as an order, or a selection), the independently editable target, and any existing request/version identity needed to distinguish repeated writes to that target. Carry the required identity through success and error actions, including actions emitted after notifications or refreshes.
2. Read the reducer's request validation and state after that request action. NgRx still runs the effect after a reducer no-op. A page/component skip-dispatch is useful UX, but does not replace effect acceptance checks.
3. When a reducer's saving flag plus matching entity ID unambiguously proves that this request was accepted, filter the effect on that reducer result instead of independently re-running validation that can drift.
4. The effect filter and every in-flight counting slice must agree on the same request-acceptance semantics.
   - A target-keyed pending entry alone cannot distinguish an accepted request from a rejected duplicate.
   - An effect-side saving filter cannot fix a counting slice that incremented on the rejected request.
   - Inspect each counter's increment, success, failure, reset and late-response paths.
   - The component must not dispatch requests the reducer would reject, but correctness must survive other action producers.

Do not add a new request envelope, global coordinator or generic acceptance abstraction by default. Use the existing action/DTO and state identity. If the established state cannot distinguish requests that must settle differently, resolve that contract explicitly rather than treating any pending record as acceptance.

## Optimistic replacement and rollback

For independently editable rows or targets:

- Validate the target and snapshot its original value **before** the optimistic replacement. Keep rollback data keyed by target and scope, or request-local where the existing contract does so. Never use one shared rollback slot for independently pending edits.
- Replace only the requested target. Keep another target's optimistic value, pending metadata and rollback snapshot intact.
- On success, use the authoritative server result for that target, reconcile newer pending edits as below, then remove only the settled request's pending/rollback data.
- On failure, restore only the failed target's applicable original snapshot, reconcile newer pending edits, then remove only the settled request's metadata. Do not replace the full collection while another target can be pending.

Where the reducer uses an async-state wrapper, preserve its helper transitions. Target-local immutable updates and pending/rollback bookkeeping still follow the reducer's established structure; do not mutate Store-owned objects.

## Queued edits to the same target

`concatMap` preserves request order, but does not prevent an earlier response from overwriting a later optimistic edit. A reload or authoritative success must reapply pending values for the same scope/target before exposing rows to the UI. Settling an older request must not delete a newer request's pending entry. A reload requested before a write settled is stale for that target even when the write was not optimistic: keep the write's authoritative value or reload again.

Capture rollback history before each request's optimistic replacement and retain the original pre-edit baseline through the pending chain. Do not overwrite the only original snapshot with an already optimistic value. If two queued edits fail, the final value must return to the original value; if an earlier write succeeds and a later one fails, rollback must respect that authoritative success. Use the existing request-local or target-keyed reconciliation pattern, not a global `previousValue`.

A response can be authoritative for its completed write and still need newer pending edits reapplied. Test that distinction; neither dropping the response nor blindly replacing the row is sufficient.

## Late responses and scope changes

Check scope/eligibility when a response settles, not only before the HTTP call. A request accepted for scope A must not write into scope B after navigation. Gate scoped state updates and any follow-on load, navigation or success notification on the appropriate current/request identity before emitting those actions.

Settle the old request's own pending metadata and counters as the established contract requires without reverting the newly loaded scope. Keep bookkeeping scope-keyed when it survives selection resets. Do not discard a terminal action required to release an in-flight count merely because its data is stale; distinguish counter settlement from eligibility to replace current data.

## Required focused coverage

The reducer-spec exception in `{CURSOR}/skills/unit-test-guidance/client-conventions.md` (spec creation boundary) applies to these changes. Require reducer specs for the state transitions and effects specs for acceptance, emission and failure behavior:

- Optimistic value and original snapshot; authoritative success; failed-target rollback; pending cleanup.
- Two simultaneously pending targets: settling either leaves the other's value, snapshot and metadata intact.
- Two queued same-target edits: the later optimistic value survives the first response/reload; both-fail and success-then-failure sequences settle correctly.
- Reducer rejection/duplicate request: no unintended HTTP write, no stranded counter, and acceptance agrees across slices.
- Scope A request completing after scope B loads: no A data, rollback or follow-on scoped action affects B; A bookkeeping settles correctly.
- Chained upstream/downstream loads preserve upstream state through both success and error transitions.

Stateful effects spec mechanics are in `{CURSOR}/skills/unit-test-guidance/client-effects.md`.
