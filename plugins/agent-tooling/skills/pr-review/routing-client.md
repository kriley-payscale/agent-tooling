# pr-review — client routing

How to match and load: step 4 in [SKILL.md](SKILL.md). Paths are relative to `{CLIENT}`.

| Changed path | Load |
|---|---|
| `**/*.component.ts`, `**/*.component.html`, other components | `{CURSOR}/rules/client-component-conventions.mdc`, `{CURSOR}/skills/client-angular-component/SKILL.md`; its references for the changed scaffolding, state/lifecycle or template detail |
| `**/*.component.scss`, or a template adding a visual element | `{CURSOR}/rules/client-component-conventions.mdc`, `{CURSOR}/skills/client-angular-component/styles.md`; run hunt C12 |
| Form control/value, validation/hydration, CVA, submission/DTO or reset behavior | `{CURSOR}/skills/client-angular-forms/SKILL.md`; its applicable state/validation or Kendo/custom-control references |
| Kendo Grid chooser hosting, persisted column visibility or paged rowIndex behavior | `{CURSOR}/rules/client-kendo-grid.mdc` |
| Kendo Chart pan/window/scale/visual or bound state-data ownership | `{CURSOR}/rules/client-kendo-charts.mdc` |
| Backend-owned Grid paging, sorting, filtering or total count (`DataStateChangeEvent`, `GridDataResult`) | `{CURSOR}/skills/server-side-pagination/SKILL.md`, for the affected layers |
| `**/actions/**` | `{CURSOR}/rules/client-ngrx-actions.mdc` |
| `**/reducers/**` reducer or state-transition changes | `{CURSOR}/rules/client-ngrx-reducers.mdc` |
| Selector composition, projector or export changes | `{CURSOR}/rules/client-ngrx-selectors.mdc` |
| `**/effects/**` | `{CURSOR}/rules/client-ngrx-effects.mdc` |
| Chained loads, optimistic writes, target or scope identity, request acceptance or rollback, pending records or in-flight counters | `{CURSOR}/skills/client-ngrx-feature-slice/async-workflows.md`, plus applicable action/reducer/effect rules; consider the workflow together |
| New slice wiring/feature registration | `{CURSOR}/skills/client-ngrx-feature-slice/SKILL.md` |
| `**/*.spec.ts` | `{CURSOR}/skills/unit-test-guidance/SKILL.md`, `{CURSOR}/skills/unit-test-guidance/client-conventions.md`; its leaves for the exercised component, signal, effects, real-Kendo or overlay behavior |
| API services: classes that call `HttpClient` or the repository's HTTP wrapper | `{CURSOR}/rules/client-data-api-service.mdc`; the .NET controller the URL targets |
| Model ownership, shape or export changes, including `**/models/**` and wire-contract types | `{CURSOR}/rules/client-models.mdc`; the .NET DTO or view model for a wire contract |
| `**/*.routes.ts`, `**/*-routing.module.ts`, `**/guards/**`, `routerLink` or `Router.navigate` changes | `{CURSOR}/skills/client-angular-route/SKILL.md`; a navigation-only correction uses its navigation section. `{CURSOR}/skills/client-angular-route/guards.md` for guard-dependent hydration, hanging activation or write-in-flight cancellation |
| Feature-flag service, guard or key changes, or any flag read | `{CURSOR}/rules/client-feature-flags.mdc`, `{CURSOR}/skills/client-angular-route/SKILL.md`; the server side of the same flag (cross-layer hunts) |
| New application, library or feature module | `{CURSOR}/skills/client-angular-feature-module/SKILL.md`, `{CURSOR}/rules/scope-creep-gate.mdc` |
| `**/index.ts` | `{CURSOR}/rules/client-barrel-exports.mdc` |
| Any `*.ts` import block change | `{CURSOR}/rules/client-import-order.mdc` |
| `Tiltfile`, files it loads, `helm/**` | `{CURSOR}/rules/tilt-conventions.mdc` |
| `package.json`, the lockfile | `{CURSOR}/rules/scope-creep-gate.mdc` (new third-party dependency needs approval) |
