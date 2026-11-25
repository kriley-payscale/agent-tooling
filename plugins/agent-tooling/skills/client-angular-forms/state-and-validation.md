# Form state, validation and hydration

## Dynamic controls and repeated hydration

- Create controls before a template binds their names, including when cached Store data is available on the first render. Reconcile repeated emissions by stable field identity; do not recreate existing controls and erase user edits on each emission.
- Use `FormGroup.addControl`/`setControl`/`removeControl` and `FormArray.push`/`insert`/`removeAt`/`clear` for changes. Do not assign `formArray.controls = []` or splice its internal array. Resetting values does not remove array controls.
- Decide whether hydration initializes a new entity/session or refreshes the current one. Preserve dirty edits unless the existing workflow explicitly replaces them. Ignore stale responses for a previous entity/open session; use the existing cancellation/identity mechanism rather than adding a second state architecture.
- When replacing a collection, clear/reconcile once at the intended boundary before adding rows; preserve ordering, disabled states and validators. Use existing row builders, not copies of their validation rules.

## Validation and readiness

- Keep existing validators when their semantics match the value. Read the codebase's custom validators (search the shared forms library for `ValidatorFn`): trimmed lengths, optional minimum length, rich-text emptiness and nonempty selections differ. Preserve their error keys and feature-specific keys; templates/helpers consume them.
- Put cross-field validation on the group that owns the related controls. A numeric value-list rule can depend on the selected data type without making every control individually invalid. Preserve where the template reads group versus control errors.
- Recalculate validity when changing validators or their external dependencies; changing an input/Store value is not itself proof that Angular reran a validator. Keep unrelated validation errors when merging/removing server errors.
- Angular async validation may leave a control `pending`; external editor validation may instead use Store loading/results and a debounce-wait flag. Distinguish these from saving, and invalidate old approval immediately when the candidate changes. Accept only results belonging to the current candidate/context, using the workflow's existing mechanism. When external validation or loading must block submit, feed it to the same readiness the action uses; Angular `pending` alone does not cover it.
- Decide readiness for each action, per the contract in [SKILL.md](SKILL.md). Preserve error-display timing and deliberate dirty/touched behavior rather than marking the entire form indiscriminately.

## Synchronization and cleanup

Keep one owner for editable values. Store/signal changes may hydrate controls; user control changes may update local derived state or dispatch. Prevent reciprocal `effect`/`valueChanges` loops: patch only when meaningful, suppress events for intentional hydration with `{ emitEvent: false }` where appropriate, and explicitly refresh any derived validity/view state that normally depends on those events, such as validity after a suppressed enable or disable. Do not silence user edits globally.

Form `.value` and `.status` reads are not automatically reactive signals. Follow the component's existing status/value subscription or interop when a computed view must update. Preserve teardown and cancellation across destroy, entity changes and reopen. Component signal, effect and lifecycle mechanics are in `{CURSOR}/skills/client-angular-component/state-and-lifecycle.md`.

One form can submit through paths with different DTO policies: one omits a disabled field through `.value`, another sends locked synchronized fields through `.getRawValue()` and then removes display-only fields. Preserve each path's decision instead of mandating raw values for every form.
