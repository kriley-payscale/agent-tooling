---
name: client-angular-feature-module
description: Use when a new Angular feature area needs its own top-level lazy-loaded route and NgRx feature registration.
disable-model-invocation: true
---

# Add a New Angular Feature Module

For adding a slice to an existing module, use skill `client-ngrx-feature-slice`. For navigation or routes in an existing module, use skill `client-angular-route`.

## Step 1 — Read existing root routing and a sibling feature module

1. Read the app's root routes (`app-routing.module.ts`, or `app.routes.ts` in a standalone app) and find where lazy routes are registered.
2. Read an existing lazy-loaded feature in the same app: its module or routes file, its routing, and where its folder sits.

If the app bootstraps standalone (`bootstrapApplication`), mirror that sibling's lazy route instead of Steps 3 and 4: a `loadChildren` routes file, with the feature's `provideState` and `provideEffects` in the route's `providers`.

## Step 2 — Create the folder structure

Put the folder where sibling features live, named the way they are named, and mirror a sibling feature's inner folders and file suffixes. Where the app has none to follow, use:

```
<feature>/
├── <feature>.module.ts
├── <feature>-routing.module.ts
├── actions/
│   └── index.ts
├── reducers/
│   └── index.ts
├── effects/
│   └── index.ts
├── pages/
│   └── feature/feature.page.{ts,html,scss,spec.ts}   # .page.* only where the app has page files, else .component.*
├── containers/                 # only when an independently connected region is needed
├── components/
├── models/
├── services/                   # services/, helpers/ and pipes/ only when the feature has them
├── helpers/
├── pipes/
└── constants/
```

Use [component scaffolding](../client-angular-component/scaffolding.md) to create/register the route target and apply its architecture, role, imports and exports. The [spec creation boundary](../unit-test-guidance/client-conventions.md) decides which specs to create. Then use skill `client-ngrx-feature-slice` to build out `actions/`, `reducers/`, and `effects/`.

## Step 3 — Create the routing module

```typescript
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FeaturePageComponent } from './pages/feature/feature.page';

const routes: Routes = [
  {
    path: '',
    component: FeaturePageComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class FeatureNameRoutingModule {}
```

For guards and their `data` shapes, child routes or tab routes, follow skill `client-angular-route`.

## Step 4 — Create the feature module

This example registers a new non-standalone page in an ordinary NgModule feature. For a standalone target, follow the architecture section of skill `client-angular-component` instead of copying this declaration.

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { reducers } from './reducers';
import { effects } from './effects';
import { FeatureNameRoutingModule } from './<feature>-routing.module';
import { FeaturePageComponent } from './pages/feature/feature.page';

@NgModule({
  imports: [
    CommonModule,
    FeatureNameRoutingModule,
    StoreModule.forFeature('feature_key', reducers),
    EffectsModule.forFeature(effects),
  ],
  declarations: [FeaturePageComponent]
})
export class FeatureNameModule {}
```

**Rules:**
- `'feature_key'` must be unique across the app; match the casing of the app's existing keys. Check `reducers/index.ts` and the `forFeature` calls across the app.
- Do not put `StoreModule.forRoot` or `EffectsModule.forRoot` here; they belong to the app's root state setup (search for `StoreModule.forRoot` or `provideStore`).
- Leaf route targets go where the app's other features keep them (`pages/` by default), regardless of whether they inject Store.
- Use a container as a parent route target only when it owns shared chrome, orchestration, or a `<router-outlet>`.
- Do not scaffold a container unless the feature has an independently connected region, and do not create a page/container pair when one only forwards to the other.

## Step 5 — Register as a lazy-loaded route

**File:** the app's root routing module.

```typescript
{
  path: 'feature-path',
  loadChildren: () =>
    import('./<feature>/<feature>.module')
      .then(m => m.FeatureNameModule)
}
```

The route must use a dynamic `import()`. Add the `canActivate` guards that sibling lazy routes in the same file use, with the `data` shapes in skill `client-angular-route`. A lazy route does not create a navigation menu entry; when one is required, follow that skill's navigation menu section.

## Step 6 — Verification scope

Verify the owning app build, focused behavior coverage and feature/root-route wiring. Commands and evidence: rule `client-build-loops`.
