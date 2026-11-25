---
name: client-angular-forms
description: Use when creating or changing Angular reactive forms, form validation or hydration, Kendo form value binding, custom ControlValueAccessors, modal form submission and dismissal, DTO submission or reset behavior. Not for static display, literal labels or unrelated Kendo Grid/Chart work.
disable-model-invocation: true
---

# Client Angular forms

Read the component, template, action handlers, parent/wrapper and relevant existing tests before changing the form.

## Guidance map

| When | Read |
|---|---|
| Changing dynamic controls or form arrays, repeated or async hydration, cross-field or server validation, or form/Store/signal synchronization | [state-and-validation.md](state-and-validation.md) |
| Changing a Kendo form input's value shape or events, or a custom ControlValueAccessor's write, change, touch, disabled or reset behavior | [kendo-and-custom-controls.md](kendo-and-custom-controls.md) |
| Choosing standalone or NgModule registration for the form's component | skill `client-angular-component` |
| Adding or changing a form or DTO type | rule `client-models` |
| Adding or changing a spec for the form | skill `unit-test-guidance` |
| Running tests, a build or lint | rule `client-build-loops` |

## Establish the contract

Preserve the component's architecture. Do not introduce Angular Signal Forms or migrate legacy forms wholesale; signals alongside Reactive Forms are not Signal Forms.

Identify these owners for the changed behavior:

1. **Form:** who creates the controls and owns the native `<form>`/`ngSubmit`? A wrapper may already own it.
2. **Action:** what does each button commit: one editor, the whole form, or accumulated Store drafts? Inspect click, Enter/native submit and parent-invoked handlers, not just the disabled binding.
3. **Value:** each control's scalar/object/array type, empty value, disabled/read-only meaning and validation error keys.
4. **DTO:** which enabled and locked fields must be sent, which display-only fields must be omitted, and where normalization belongs.
5. **Reset:** who clears values, validation, dirty/touched state, edit identity and Store drafts on success, cancel, close and reopen?

Controls and validators:

- For new fixed-shape forms, prefer typed controls and deliberate nullable/reset defaults; use a non-nullable builder only when resetting to initial values matches the contract. Keep existing form styles for scoped edits.
- Choose validators by value semantics. Angular's `Validators.required` accepts `false` and `0` (use `requiredTrue` for a box that must be checked); read a custom required validator before reuse, since one that rejects whitespace, `false` and `0` is wrong for booleans and numeric IDs.
- Preserve error keys consumed by templates and validation-message helpers.

Map the outgoing DTO explicitly. For an enabled group, `.value` omits disabled children; `.getRawValue()` includes them. A disabled group has different aggregate-value behavior, so do not use disablement as the DTO policy. Read the actual contract and select fields deliberately; neither accessor is a universal default.

Readiness belongs to the action:

- Distinguish `valid`/`invalid`, Angular `pending`, external validation/loading, draft changes and submitting.
- Preserve the intended handler guard and prevent duplicate requests where multiple entry paths can commit; a disabled footer alone does not guard native or programmatic submit.
- Do not gate every action on whole-form validity, make a final Save implicitly commit unconfirmed editor text, or reset drafts before the action's success/cancel policy permits it.

## Modal forms

Read the modal wrapper and the caller together; wrappers differ in who owns the native `<form>`, the open state and the reset. When the wrapper renders the `<form>`, project controls into it, never a second native `<form>`.

- **Footer gating is not handler gating.** A wrapper's footer button and its submit handler often check different conditions, and Enter or a programmatic submit skips the footer. Where the workflow must block invalid, pending or duplicate submissions, enforce it in the action handler or state owner. Do not change a shared wrapper as a side effect of changing one caller.
- **One reset owner.** When the wrapper resets the form on close, the caller does not reset it again; coordinate explicit defaults, rebuilt arrays or retained drafts with that reset. A plain `reset()` yields `null` for nullable controls.
- **Each dismiss path is separate.** Header close, Escape, backdrop and Cancel can each be enabled on their own, and one setting may cover several. Hiding Cancel does not stop Escape or a backdrop click (in ng-bootstrap those are the `keyboard` and `backdrop: 'static'` options). If Cancel must work while the others are off, give it a caller-owned action rather than re-enabling dismissal. Find who consumes the dismiss output (a dismissed ng-bootstrap modal rejects its `result` promise, and cleanup after a submit attempt can emit dismiss too), and keep cancel handling apart from success effects.
- The caller usually owns the open state; emitting submit or dismiss does not close the modal by itself.

Specs for dismissal paths and focus: `{CURSOR}/skills/unit-test-guidance/client-overlays.md`.

## Verification

Verify the changed value, action, DTO and reset contracts. A custom control needs proof through a host with a real `FormControl`.
