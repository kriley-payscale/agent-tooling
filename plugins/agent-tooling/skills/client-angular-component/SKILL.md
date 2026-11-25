---
name: client-angular-component
description: Use when creating or modifying an Angular component, page or template, selecting existing standalone versus NgModule architecture and only the applicable scaffolding, state/lifecycle, template, loading or style detail.
disable-model-invocation: true
---

# Create or modify an Angular component

Read rule `client-component-conventions` for role, folder and Store responsibility. Inspect the current artifact and a same-role sibling before writing.

## Guidance map

| When | Read |
|---|---|
| Creating or extracting a component, or changing its module or standalone registration, imports or exports | [scaffolding.md](scaffolding.md) |
| Changing inputs, outputs or `model()`, local or Store-derived signals, effects, RxJS interop, subscriptions or lifecycle hooks | [state-and-lifecycle.md](state-and-lifecycle.md) |
| Adding a component, directive or pipe to a template, or adding or moving a QA/test id | [templates.md](templates.md) |
| Adding or changing a loading container, a loading indicator or a load-error message, or a template shows content that an API load or reload replaces | [loading.md](loading.md) |
| Adding or changing component SCSS, or adding a visual element (button, badge, card, form field, focus state, banner, empty state) to a template | [styles.md](styles.md) |
| Adding or changing a type or contract | rule `client-models` |
| Changing form controls (including Kendo form inputs and custom ControlValueAccessors), validation, values, DTO submission or reset | skill `client-angular-forms` |
| Adding or changing a component or effects spec | skill `unit-test-guidance` |
| Adding a feature module | skill `client-angular-feature-module` |
| Adding or changing NgRx actions | rule `client-ngrx-actions` |
| Adding or changing NgRx reducers | rule `client-ngrx-reducers` |
| Adding or changing NgRx effects | rule `client-ngrx-effects` |
| Adding or changing NgRx selectors | rule `client-ngrx-selectors` |
| Changing Kendo Grid column chooser, column visibility, scrollable mode or row index | rule `client-kendo-grid` |
| Changing Kendo Chart panning, zoom, axis scaling, series visuals or state-bound data | rule `client-kendo-charts` |
| Running tests, a build or lint | rule `client-build-loops` |

## Architecture

- Preserve an existing component's standalone or NgModule architecture anywhere in the workspace. Inspect its decorator, declaring/consuming modules, and same-role sibling; a folder name does not make it a library component.
- New components in ordinary NgModule features use explicit `standalone: false` and the feature module's declarations. New components in a shared UI library follow that library's standalone, selector-prefix, QA and public-export conventions.
- An app consuming a shared-library control keeps the consumer's architecture and selector prefix. Standalone template dependencies use `@Component.imports`; NgModule components use the declaring module's `imports`. Standalone components go in TestBed/consumer `imports`, never `declarations`.

Apply changes incrementally. Do not move artifacts, convert architecture or rewrite untouched legacy bindings to satisfy a new-component example.

## Verification

Verify changed behavior, production wiring and real rendered directives where relevant.
