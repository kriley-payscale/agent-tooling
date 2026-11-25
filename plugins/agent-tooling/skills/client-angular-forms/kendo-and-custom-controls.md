# Kendo form binding and custom controls

## Value and event ownership

- Read the actual widget inputs/events, installed types and surrounding usage. Establish whether the control holds a primitive ID/string, an item object or an array, including clear/reset values. Match `valuePrimitive`, `valueField`, `textField`, custom-value behavior and the options' shape to that contract.
- Prefer the existing Reactive Forms binding for form-owned values. Do not add a second `[value]`/output write path merely to mirror `formControlName`. Preserve specialized existing bridges until their replacement is in scope; inspect what each path does before removing it.
- Distinguish selection, value, filtering and blur events. A filter string is not automatically a committed value. One user commit must update the form once even when Enter, value change and blur all occur; do not wire both a CVA callback and an output back into the same form control.
- Drive reactive-form enable/disable through the control and ensure the actual widget reflects it. Keep read-only distinct from disabled, including DTO omission and keyboard interaction. Keep the associated label, accessible name, described errors and existing QA IDs when changing the binding.

For local exemplars, find a Kendo input bound with `formControlName` and an existing accessor (`rg -l 'implements ControlValueAccessor' {CLIENT} -g '*.ts'`). Read them for local conventions; where they differ from the contracts here, the contracts win, and a legacy value bridge is not a pattern to copy as a second binding.

## Controlled Kendo editor that saves on change

For a controlled Kendo editor, do not synchronously bind `[disabled]` to saving state changed by its own `(valueChange)` dispatch. This can raise `NG0100` because Kendo's `k-disabled` host binding changes during selection, and `[value]` can snap back to the confirmed value.

- Keep the editor enabled during the save and suppress unchanged or duplicate pending-row emissions in the handler/reducer.
- Display the requested value optimistically; let the authoritative success response win and restore the prior target value on failure.

## Custom ControlValueAccessor (CVA) contract

Preserve an existing CVA's public value/output contract. A new or changed CVA satisfies these behaviors:

1. `writeValue` updates the view from the model without calling the registered change/touched callbacks or emitting a user-change output. Normalize null/reset to the agreed empty shape; avoid mutating an array supplied by the caller.
2. `registerOnChange` stores the callback. A committed user edit calls it exactly once with the agreed shape. If a separate public output exists, preserve its consumers without creating a second form propagation path.
3. `registerOnTouched` stores the callback; blur or the control's equivalent completion interaction marks it touched. A programmatic write does not simulate a user touch.
4. Implement `setDisabledState` for new CVAs so parent `disable()` and `enable()` affect the rendered widget and user interactions; do not emit a value change solely because disabled state changed.
5. Reset restores the agreed empty value and clears transient text/selection state so a subsequent blur/Enter cannot recommit a previous draft. Keep disabled state consistent with the parent control's reset contract.

The spec that proves this contract through a host with a real `FormControl` is described in `{CURSOR}/skills/unit-test-guidance/client-components.md`.
