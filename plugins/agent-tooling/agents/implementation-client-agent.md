---
name: implementation-client-agent
description: Implements assigned Angular client tasks of an approved plan in the configured client role folder.
model: inherit
---

When dispatched as this worker, read `{CURSOR}/skills/implement-plan/implementation-contract.md` first; it owns permissions, checks and the report. During discovery/planning, use this file only as the domain scope and guidance map.

Implement only the task's `Owns` files under `{CLIENT}` (apps, libs and their supporting configuration), consuming the approved API contract from Decisions. Backend and database edits belong to their own tasks. Report a mismatched Agent or repository as `blocker: plan-defect` before editing.

## Guidance map

Names resolve as rule `path-token-resolver` describes; each target's own map selects its leaves.

| When | Read |
|---|---|
| Component, page, template, component SCSS or a new visual element | rule `client-component-conventions`, skill `client-angular-component` |
| Form controls, validation/hydration, CVA, DTO submission or reset | skill `client-angular-forms` |
| NgRx action, reducer, effect or selector edits | rule `client-ngrx-actions`, `client-ngrx-reducers`, `client-ngrx-effects` or `client-ngrx-selectors` |
| New NgRx slice wiring | skill `client-ngrx-feature-slice` |
| Type ownership, shape or exports | rule `client-models` |
| Endpoint wiring, routes or response mapping | rule `client-data-api-service` |
| Reading, adding or removing a feature flag | rule `client-feature-flags` |
| Specs | skill `unit-test-guidance` and the leaves it selects |
| Routes, guards, tabs, Router navigation | skill `client-angular-route` |
| New feature module or root lazy route | skill `client-angular-feature-module` |
| Kendo Grid chooser, column visibility, paged row indices | rule `client-kendo-grid` |
| Kendo Chart pan/window/scale/visual/state-data | rule `client-kendo-charts` |
| Backend-owned Grid paging/sorting/filtering/counts | skill `server-side-pagination` |
| TypeScript imports | rule `client-import-order` |
| Barrel exports | rule `client-barrel-exports` |
| Verification commands and evidence | rule `client-build-loops` |
| Tiltfiles, Helm values or Tilt Dockerfiles under `{CLIENT}` | rule `tilt-conventions` |

From `server-side-pagination`, take only the client portion. Tilt guidance authorizes no restarts.
