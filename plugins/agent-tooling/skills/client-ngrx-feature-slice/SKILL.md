---
name: client-ngrx-feature-slice
description: "Use when adding and registering an NgRx slice in an existing Angular feature module. Coordinates artifact ownership and conditionally selects chained/optimistic async workflows; ordinary effect or selector edits use their artifact rules."
disable-model-invocation: true
---

# Add a New NgRx Feature Slice

## Guidance map

| When | Read |
|---|---|
| Changing chained loads, optimistic writes, target or scope identity, request acceptance or rollback, pending records or in-flight counters | [async-workflows.md](async-workflows.md) |
| Adding or changing actions | rule `client-ngrx-actions` |
| Adding or changing a reducer or its state | rule `client-ngrx-reducers` |
| Adding or changing effects | rule `client-ngrx-effects` |
| Adding or changing selectors or `reducers/index.ts` | rule `client-ngrx-selectors` |
| Adding or changing state, payload or model types | rule `client-models` |
| Adding or changing an API service method | rule `client-data-api-service` |
| Adding a feature module for the slice | skill `client-angular-feature-module` |
| A route guard consumes the slice's state | skill `client-angular-route` |
| Adding or changing specs | skill `unit-test-guidance` |
| Running tests, a build or lint | rule `client-build-loops` |

## Wire a new slice

1. Find where the feature keeps its state files: per-type `actions/`, `reducers/` and `effects/` folders, or one folder such as Nx's `+state/`. Read its state composition (`reducers/index.ts`, a `createFeature` or the reducer map) for the feature state interface and selector key, its store and effects registrations (`StoreModule.forFeature` / `EffectsModule.forFeature`, or `provideState` / `provideEffects`), and one existing actions/reducer pair. Each artifact rule decides new-file versus existing-file style; neighboring files do not override that decision.
2. Create `[slice-name].actions.ts` beside the feature's other actions using the actions rule, including its failure action suffix. Export it from the actions barrel when the feature has one.
3. Create `[slice-name].reducer.ts` beside the feature's other reducers using the reducers rule for async state, its transitions and exported slice-local getters. If a guard consumes the state, the route skill decides load ownership; do not start the guard-required load in the routed component.
4. Add the slice to the feature's state composition using the selectors rule: reducer import, feature state interface, reducer map and composed selectors.
5. Create `[slice-name].effects.ts` beside the feature's other effects using the effects rule. Export the class from the effects barrel when there is one, and add it to the existing effects registration. Preserve the existing feature store key and registration pattern.
6. Add or change an API method only if needed, using the API service rule. Do not duplicate HTTP mapping inside the effect.

## Specs and verification

The spec creation boundary in [client-conventions.md](../unit-test-guidance/client-conventions.md) decides which specs a new slice gets, including when a reducer spec is required.

Verify changed behavior with focused existing component/effect/reducer coverage as applicable. Model, action-payload and type-only import boundary changes also require the consuming app build; lint and isolated Jest do not prove type/module resolution.
