# pr-review — client defect hunts

Hunt format and the verification ladder: [defect-hunts.md](defect-hunts.md) and [SKILL.md](SKILL.md). State hunts (C1–C4, C6, C11) apply when the client keeps state in NgRx; check the same shapes in whatever store the repository uses.

### C1 — Late response settles into another scope
- **Signal:** a success or error action from a request whose scope (the selected record, project, filter or selection) can change while the request is in flight. Look for actions without scope identity in their props, reducers that store the payload unconditionally, or side-effect actions appended before an eligibility check.
- **Verify:** L3. In the effects spec, emit the request for scope A, switch to scope B, return A's response, and assert that nothing scoped to A reaches B's state.
- **Rule:** `{CURSOR}/rules/client-ngrx-effects.mdc` (Operator selection), `{CURSOR}/skills/client-ngrx-feature-slice/async-workflows.md` (Request identity and acceptance; Late responses and scope changes).
- **Example:** an effect that filters on the loaded scope ID and carries `widgetId` in every result action, and a reducer that reverts on error only when `action.widgetId === state.loadedWidgetId`.

### C2 — Newer write overwritten by an earlier response
- **Signal:** the reducer replaces rows with a response requested before a later write settled: an earlier response while queued edits are still pending (`concatMap` queues writes, but nothing reapplies the queued values), or a reload that read pre-write data and settles after a non-optimistic row write succeeds.
- **Verify:** L3. Queue two edits to one row, resolve the first, and assert that the second edit's value survives. For a reload, start it, settle the write, then return the reload's pre-write rows, and assert that the row keeps the saved value or a fresh reload is dispatched.
- **Rule:** `{CURSOR}/skills/client-ngrx-feature-slice/async-workflows.md` (Queued edits to the same target).
- **Example:** a load-success reducer that reapplies pending edits, kept by row ID, over the loaded rows before exposing them.

### C3 — Rollback slot shared between edits
- **Signal:** a single `previousValue` or snapshot field in state used for every in-flight edit, so a second edit to the same cell overwrites the first edit's rollback value.
- **Verify:** L3. Two failing edits to one cell must restore the original value.
- **Rule:** `{CURSOR}/skills/client-ngrx-feature-slice/async-workflows.md` (Optimistic replacement and rollback).
- **Example:** an error action that carries its own request's previous value instead of reading a shared slot.

### C4 — Duplicate dependent loads
- **Signal:** two effects both reacting to the same success action by dispatching the same load, or a load dispatched from both an effect and a component.
- **Verify:** L3. Count dispatched load actions for one trigger with `provideMockActions`.
- **Rule:** `{CURSOR}/skills/client-ngrx-feature-slice/async-workflows.md` (Chained transitions and load ownership), `{CURSOR}/rules/client-component-conventions.mdc`; `{CURSOR}/skills/client-angular-route/guards.md` only when the duplicate is guard-dependent hydration.
- **Example:** none to cite; use the rule.

### C5 — `undefined` or unused IDs serialized into query parameters
- **Signal:** `params: { a, b }` in an API service where a value can be `undefined`, `null`, or an ID that does not apply to the current mode. Angular's `HttpParams` serializes these as `"undefined"` or `"null"`.
- **Verify:** L1 by reading the service and the .NET action's parameter types; L3 with an `HttpTestingController` expectation on the request URL.
- **Rule:** `{CURSOR}/rules/client-data-api-service.mdc`.
- **Example:** none to cite; use the rule.

### C6 — Kendo mutating store-owned objects
- **Signal:** store-selected arrays or objects bound straight into Kendo Grid editing or Chart data, or mutated in a component handler.
- **Verify:** L3. A spec that freezes the state (NgRx runtime checks) and drives the edit path.
- **Rule:** `{CURSOR}/skills/client-ngrx-feature-slice/async-workflows.md` (Optimistic replacement and rollback: do not mutate Store-owned objects); `{CURSOR}/rules/client-kendo-charts.mdc` only for Chart state-data cloning; `{CURSOR}/skills/client-angular-forms/kendo-and-custom-controls.md` only for changed form-editor value ownership.
- **Example:** a reducer that keeps `originalData: structuredClone(rows)` separate from the editable copy.

### C7 — Wire casing drift between server JSON and client model
- **Signal:** a client model whose property casing differs from the JSON the server sends, with no mapping in the API service; or casing conversion inside effects, reducers, or components. ASP.NET Core serializes camelCase by default, but `PropertyNamingPolicy = null`, Newtonsoft settings or OData can keep PascalCase, so check the server's serializer settings.
- **Verify:** L1 by comparing the .NET DTO, the serializer settings and the client model; L4 with an authenticated GET showing the real casing.
- **Rule:** `{CURSOR}/rules/client-data-api-service.mdc` (Backend response normalization).
- **Example:** an API service that maps the response to the client model in one place, such as `map(toWidget)` on the HTTP call.

### C8 — Guard bypassed on initial bootstrap
- **Signal:** a "no selection", permission, or readiness guard enforced on a user action but skipped on the first load, a deep link, or a direct refresh.
- **Verify:** L3. Route or effects spec covering the first load and the deep link.
- **Rule:** `{CURSOR}/skills/client-angular-route/SKILL.md` (navigation and guard data); `{CURSOR}/skills/client-angular-route/guards.md` when activation depends on hydration or pending writes.
- **Example:** a route whose `canActivate` runs the same check as the user action, so a deep link or refresh is covered.

### C9 — Async export or HTTP error hides the server reason
- **Signal:** `catchError` replacing a 400 reason body with a generic message, or an async export (blob or workbook) failure that never reaches the error action.
- **Verify:** L3. An effects spec returning an `HttpErrorResponse` with a string body.
- **Rule:** `{CURSOR}/rules/client-ngrx-effects.mdc` (Failure handling); `{CURSOR}/rules/client-data-api-service.mdc` when the actual response shape or normalization changes.
- **Example:** an effect that shows `error.error` when it is a string and falls back to a generic message only otherwise.

### C10 — Locale hardcoded to en-US
- **Signal:** `'en-US'` passed to `Intl.NumberFormat`, `DecimalPipe`, `toLocaleString`, or export formatting.
- **Verify:** L1.
- **Rule:** none canonical; cite how the repository resolves the user's locale.
- **Example:** code that takes the locale from Angular's `LOCALE_ID` or the repository's own locale helper (`git grep -n -i locale -- '*.ts'`).

### C11 — Optimistic aggregate recomputed from the loaded page
- **Signal:** on a server-paged grid, an optimistic reducer recomputes a dataset-wide count or total (selected count, total, sum) from the rows currently loaded instead of applying a delta to the server value or keeping the server value until the response arrives.
- **Verify:** L0 by tracing the reducer against the request it mirrors; L3 with a fixture whose server count exceeds the selected rows on the loaded page, then toggle one row and assert the count equals the server count plus or minus one.
- **Rule:** `{CURSOR}/skills/server-side-pagination/SKILL.md` (Cross-Layer Recipe: page-safe optimistic selection; selection counts cover every selected row, not the current page).
- **Example:** none to cite; use the rule.

### C12 — Component SCSS re-implements the design system
- **Signal:** new component SCSS that declares a button, badge, card surface or focus ring that the repository's design system (shared components, global classes, mixins, tokens) already provides; raw values equal to a token (radius, font size, weight, on-scale spacing, theme colors); `var()` names no stylesheet defines; or design-system tokens and classes used where the scope that defines them (such as a theme root class) is absent.
- **Verify:** L1. Run "Find the design system", "Determine the context" and "Check before finishing" in `{CURSOR}/skills/client-angular-component/styles.md` against the changed SCSS and templates.
- **Rule:** `{CURSOR}/skills/client-angular-component/styles.md` (Style reuse ladder).
- **Example:** component SCSS that uses the system's focus-ring mixin and radius token instead of raw values.
