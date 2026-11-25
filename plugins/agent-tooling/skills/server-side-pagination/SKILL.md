---
name: server-side-pagination
description: "Use when an Angular Kendo Grid needs server paging, sorting, filtering or a total count (DataStateChangeEvent, GridDataResult, State, sort and filter descriptors), or when an API endpoint pages, sorts or filters rows for a grid. Not client-paged row indices or visual-only Grid changes."
disable-model-invocation: true
---

# Server-Side Pagination

Use this when a Kendo Grid must let the API own paging, sorting, filtering and the total count. It orders the work across layers; each layer's detail lives with its owner.

## Guidance map

Load the owner of a layer before planning or editing that layer, and only for the layers the change touches.

| When | Read |
|---|---|
| Adding or substantially changing the Angular component | skill `client-angular-component` |
| Changing shared request or response models | rule `client-models` |
| Changing API service wiring | rule `client-data-api-service` |
| Changing existing NgRx actions | rule `client-ngrx-actions` |
| Changing existing NgRx effects | rule `client-ngrx-effects` |
| Changing existing NgRx reducers | rule `client-ngrx-reducers` |
| Changing existing NgRx selectors | rule `client-ngrx-selectors` |
| Wiring a new NgRx slice | skill `client-ngrx-feature-slice` |
| Chained loads, optimistic writes, target or scope identity, request acceptance or rollback, pending records or in-flight counters | `{CURSOR}/skills/client-ngrx-feature-slice/async-workflows.md` |
| Changing Kendo Grid chooser, visibility or row-index behavior | rule `client-kendo-grid` |
| Writing Kendo component or effects specs | skill `unit-test-guidance` |
| Shaping the repository LINQ, fast paths or aggregates, or triaging a slow query | skill `dotnet-ef-query-optimization` |
| Smoke-testing the API with an authenticated local call | skill `api-auth` |

## Find the existing paging contract

Before choosing an approach, find the codebase's closest working server-paged grid and its endpoint: search the API for request types with `Skip`/`Take` or `Page`/`PageSize` and responses with a total (`TotalCount`, `Total`), and the client for `GridDataResult` and `dataStateChange`.

- Reuse that request and response pair when it fits. Otherwise define one request carrying paging (skip and take, or page and size), sort and filter, and one response carrying the page's items and the total.
- Preserve an existing grid wrapper when it meets the requirement. Verify its paging, search and filter combination against the endpoint before relying on it; an endpoint override alone does not prove the combination works.
- When a wrapper already owns grid state, do not add a second state owner; use the recipe below only for a grid whose component owns its Kendo `State`.

## Cross-Layer Recipe — component-owned Kendo state

1. The request contract sends grid state together:
   - paging: the contract's skip/take or page/size shape
   - sort: allowlisted sort descriptors
   - filter: allowlisted filter descriptors

2. The Angular component owns one Kendo `State` signal.
   - Bind the grid with `[data]="gridData()"`, where `gridData()` returns `GridDataResult`.
   - Do not use `[kendoGridBinding]` when the server owns paging.
   - Do not call Kendo `process()` for sorting, filtering or paging server-returned rows; it re-sorts only the current page and re-applies `skip` to rows the server already skipped.
   - On `dataStateChange`, dispatch a reload with the next `State`.
   - Reset `skip` to `0` when sort or filter changes.
   - Preserve `skip` and `take` for page changes.

3. The NgRx effect (or the data service, without NgRx) maps Kendo state to the API request, once.
   - Convert `skip`/`take` to the contract's paging shape.
   - Convert Kendo sort and filter descriptors to the backend request shape in one place.
   - Only send backend-representable field names; drop or reject function-backed Kendo fields.

4. Reducer and selectors expose server totals.
   - Store the response that includes the current page's rows plus the total.
   - Map the backend total to `GridDataResult.total`.
   - Add a selector for the total count.
   - Preserve page-safe optimistic row selection: update only currently loaded rows unless an existing endpoint handles all eligible rows.

5. The backend validates before querying.
   - Translate grid fields through an explicit allowlist.
   - Allowlist operators per field when fields support different operations.
   - Reject or ignore unsupported fields and operators deliberately.
   - Never allow arbitrary client field names to become dynamic EF or SQL access.

6. The repository keeps the fast path.
   - Base and display field filters and sorts happen before count and page where possible.
   - The total is the filtered match count, not the table count. Selection counts stay all selected parents, not the current page.
   - Order by the requested sort, then a unique key, before `Skip`/`Take`. Without the tiebreak, rows with equal sort values can repeat or vanish between pages.
   - For query shape (page before fan-out joins, paging by parent ID when a computed aggregate is filtered or sorted, slow queries), stop and use skill `dotnet-ef-query-optimization`, starting with `{CURSOR}/skills/dotnet-ef-query-optimization/read-shape.md`.

## Verification Checklist

- Backend request validation covers unsupported fields and operators.
- The effect or service spec asserts the paging, sort and filter request shape.
- A component spec asserts `GridDataResult.total` comes from the backend total.
- A component spec asserts page changes dispatch the current `skip`/`take`.
- A component spec asserts sort and filter changes reset to page one.
- The focused frontend target passes.
- Impacted .NET tests pass after the test project builds (rule `dotnet-build-loops`).
- If local data and auth exist, smoke-test page one, page two, one base sort or filter, and one aggregate sort or filter through the API.
