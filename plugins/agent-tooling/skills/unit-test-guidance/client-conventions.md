# Angular testing conventions

## Spec creation boundary

Create specs for the kinds of files the codebase already covers. Check which source files near the change have specs (components, effects, reducers, API or other services) and follow that pattern: in those kinds, cover changed behavior with new or updated cases. Whatever the pattern, a spec, or new cases in an existing one, is required when:

- **The reducer case being changed** involves chained loads, optimistic writes, target or scope identity, request acceptance or rollback, pending records or in-flight counters. Cover the cases `{CURSOR}/skills/client-ngrx-feature-slice/async-workflows.md` lists for the change.
- **An approved plan** lists the spec in a task's `Owns`.
- **The user asks for it.**

For kinds the codebase does not routinely cover, add nothing outside those cases: when a change breaks an existing spec of such a kind, repair the failing cases and add none.

Place and name specs like the existing ones. The Angular default co-locates them and mirrors the file name: `my-feature.component.ts` → `my-feature.component.spec.ts`.

## Test ownership by role

- **Page/container:** route/Store orchestration, its own selector-derived state, dispatch/navigation, loading/error composition and child contracts. Do not retain tests for child-owned save dispatches, former save outputs or pass-through page handlers.
- **Presentational component:** inputs, rendering, local interaction, validation and intent outputs. Store/Router/ActivatedRoute setup merely to instantiate a reusable presentational component suggests a misplaced boundary.
- **Connected feature component:** assert its own Store reads and writes. Store setup is appropriate here. If a shallow parent retains a real child, still map selectors that child consumes even after parent selectors are removed.

Keep parent tests shallow when child behavior is unrelated; use real children when their rendered integration is under test. Production role/Store ownership is in rule `client-component-conventions`.

## TestBed dependencies and schema

Preserve architecture: standalone targets use TestBed `imports`, non-standalone targets use `declarations`. Keep setup minimal and import each component/directive/pipe/module whose behavior the spec exercises.

Default to no schema. `NO_ERRORS_SCHEMA` is only for intentionally shallow, unrelated children; document what it suppresses. Never hide a tested dependency behind it. Do not use `CUSTOM_ELEMENTS_SCHEMA`.

For shallow non-standalone children, focused stubs match the selector and every bound input/output. `NG0304` unknown-element output is a harness defect even if Jest exits successfully; do not import an unrelated full graph just to quiet it.

Third-party/native-enhanced controls require their real owning module and framework-rendered proof. A native click, disabled or ARIA assertion alone does not prove the directive instantiated, especially when the app compiles with `strictTemplates: false`.

## Store and dependency mocks

For signal-based component tests, follow the Store mock styles in [client-signals.md](client-signals.md). Do not replace working tests solely to change mock style.

Use `StoreModule.forFeature` when testing behavior that requires the real feature state/reducers; use `provideMockStore` for controlled selectors/effects. Stateful effects that depend on reducer transitions use the real reducer-before-effect sequence in [client-effects.md](client-effects.md), rather than overriding away the transition under test.

When a spec uses `overrideSelector`:

- Call `store.resetSelectors()` in `afterEach` on the same MockStore that set the overrides, and at the start of a `setState`-driven `beforeEach` before establishing state.
- An override is stored on the module-level memoized selector, and `resetSelectors()` clears only the overrides of its own store. A leaked override keeps answering in later tests, including ones that expect composed selectors to read real `setState` state; a fresh store cannot repair it.
- Change an override's result with `setResult()` plus `refreshState()`.

Simple dependencies use inline `useValue` mocks, such as `{ navigate: jest.fn() }` or `{ load: jest.fn(), save: jest.fn() }`. An ActivatedRoute mock supplies the snapshot params and observable query params actually used. Stateful/complex dependencies may use a spec-local `Mock*` class with a `BehaviorSubject` and mocked methods.

Type mocks at the `useValue` boundary, for example `jest.Mocked<Pick<Service, 'load'>>`, and keep that typed reference. Do not recast `TestBed.inject(Service)`, use `as unknown as jest.Mocked<Service>`, or type a partial object as `jest.Mocked<Store>` through `as any`. Assert `store.dispatch` where the write belongs; spy on dispatch for a real Store, or use the mock's dispatch spy.

## Cleanup

Clean up subscriptions/Subjects, DOM nodes/popups, globals/spies and fake timers the spec owns even when an assertion fails. Restore real timers in `afterEach` after deferred-focus tests.

DOM typings do not prove jsdom implements an API. Before `jest.spyOn`, inspect the property; for absent/non-writable APIs, save the original descriptor, install a configurable mock with `Object.defineProperty`, then restore the descriptor in `finally`/`afterEach`, deleting a temporary property when no descriptor existed. Do not leak modified globals.

## Formatted display-string assertions

Before changing shared display precision, search the whole app for literal formatted-string assertions, including sibling component/page/view-model specs that do not import the formatter. Search the rendered shape (for example `\d+\.\d+%`), not only the formatter name.

Do not anchor a rounded assertion on an exact-half fixture unintentionally. `Intl.NumberFormat` defaults to `halfExpand` (`2.5` → `3`, `-4.5` → `-5`); use fixtures clearly to one side of the boundary and include a negative case to pin sign handling.

## QA queries

Query nodes the way sibling specs do (a test-id attribute such as `data-qa-id`, a role, or text), preserving existing IDs byte for byte. Which nodes get an ID, and how a new one is named, follow `{CURSOR}/skills/client-angular-component/templates.md`; do not add one outside those rules to make a query easier.
