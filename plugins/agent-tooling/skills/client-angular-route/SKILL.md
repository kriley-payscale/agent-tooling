---
name: client-angular-route
description: Use when adding or changing Angular routes, route guards, child routes, tab routes, Router navigation, deep links, direct-refresh failures, hanging navigation, navigation menu entries, or NgRx-backed route hydration. For a new feature module with its own top-level route, use client-angular-feature-module instead.
disable-model-invocation: true
---

# Client Angular Routing

For a navigation path, `routerLink` or `Router.url` change, use [Navigating to routes](#navigating-to-routes). For a route configuration change, start at [Step 1](#step-1--read-the-target-routing-module-mandatory) and apply the steps that match the change.

## Guidance map

| When | Read |
|---|---|
| A guard needs NgRx state loaded before activation (cold deep link, hanging activation), or a guard cancels navigation while writes are in flight | [guards.md](guards.md) |
| Creating, extracting or registering a route target component | `{CURSOR}/skills/client-angular-component/scaffolding.md` |
| Adding a feature module with its own top-level lazy-loaded route | skill `client-angular-feature-module` |
| Running tests, a build or lint | rule `client-build-loops` |

## Navigating to routes

Angular Router paths are relative to the app's base href (`<base href>` in `index.html`, or `baseHref` in the build options). When the app is served under a sub-path such as `/my-app/`, do not include that prefix in `Router.navigate`, `Router.navigateByUrl`, `routerLink`, or `Router.url`.

```typescript
// correct — Angular applies the base href
this.router.navigate(['/<feature>']);
this.router.navigateByUrl('/<feature>/<id>');
```

```html
<!-- correct — Angular applies the base href -->
<a [routerLink]="['/<feature>', id]">Open</a>
```

```typescript
// wrong — duplicates the base href in browser URLs
this.router.navigate(['/my-app/<feature>']);
this.router.navigateByUrl('/my-app/<feature>/<id>');
```

Treat `Router.url` the same way: it is relative to the base href. Route-detection regexes and tests that mock `router.url` must use that app-relative path. Do not match the base href unless you have measured that this app's `Router.url` actually includes it.

```typescript
// correct — Router.url is app-relative
/^\/<feature>(?:\/|$)/.test(this.router.url)

// wrong — the base href is not on Router.url
/^\/my-app\/<feature>(?:\/|$)/.test(this.router.url)
```

Exceptions:
- Plain browser `href` values may need the full path including the base href.
- API-returned URLs and server-driven navigation metadata may need full browser paths.

The prefix belongs on those only.

## Navigation menu entries

Adding a route does not add a menu or sidebar entry. Find where the app's navigation is defined: a static list in the shell or layout component, or data the server returns. When it is server-driven, confirm whether an entry already exists, and add one the way existing entries are added on the server side (data, configuration or a seed script). Do not invent a client-only workaround for a server-driven menu.

## Step 1 — Read the target routing module (mandatory)

Read the `*-routing.module.ts` or `*.routes.ts` you are modifying before writing anything. For a new route group, also read a sibling feature's routing in the same app. Confirm:
- Which guards are already imported and in use
- Whether `forChild` or `forRoot` is used (feature routing always uses `forChild`)
- Whether there are existing child route patterns to follow

## Step 2 — Add a flat route

```typescript
const routes: Routes = [
  // existing routes...
  {
    path: 'my-path',
    component: MyPageComponent
  }
];
```

For a redirect default:
```typescript
{ path: '', redirectTo: 'my-path', pathMatch: 'full' }
```

## Step 3 — Add a parameterized route

```typescript
{
  path: 'items/:id',
  component: MyDetailComponent
}
```

Read the param in the routed page or layout container, not in a presentational child:
```typescript
private route = inject(ActivatedRoute);
readonly itemId = toSignal(this.route.paramMap.pipe(map(p => Number(p.get('id')))));
```

## Step 4 — Add child routes

Nest routes under a parent using `children: []`. The parent component must include a `<router-outlet>` in its template.

```typescript
{
  path: 'orders/:id',
  component: OrderLayoutComponent,
  children: [
    { path: '', redirectTo: 'overview', pathMatch: 'full' },
    { path: 'overview', component: OrderOverviewPageComponent },
    { path: 'lines', component: OrderLinesPageComponent }
  ]
}
```

Place a parent route shell under `containers/` when it owns shared chrome, orchestration, or the `<router-outlet>`. Place navigable leaf route screens under `pages/`, or where the feature's pages already live, even when they inject Store. Do not add both a page and a container when one only forwards to the other.

When a guard needs NgRx state loaded before activation, or a guard cancels navigation while writes are in flight, read [guards.md](guards.md).

## Step 5 — Guards and required `data` shapes

Use the guards the routing module and its siblings already use; list them with `grep -rn 'canActivate' <app-root> --include='*.ts'`. Before putting a guard on a route, read it to see which `route.data` keys it reads, and match that shape exactly. A missing or misspelled key reads as `undefined`, and the guard then allows or denies without an error.

Import guards through their library's path alias, not deep relative paths. Several guards on one route share one `data` object:

```typescript
{
  path: 'widgets',
  component: WidgetListPageComponent,
  canActivate: [MyAccessGuard, MyFeatureFlagGuard],
  data: {
    permission: 'widgets.view',
    featureFlag: 'my-feature'
  }
}
```

The guard names and `data` keys here are placeholders; use the ones the guards read.

## Step 6 — Tab-style routes (same component, different `data`)

When multiple routes render the same component but activate a different tab based on `data`, follow this pattern:

```typescript
const routes: Routes = [
  {
    path: '',
    component: MyPageComponent,
    data: { selectedTab: MyPageConfig.DefaultTabId }
  },
  {
    path: 'settings',
    component: MyPageComponent,
    data: { selectedTab: MyPageConfig.SettingsTabId }
  }
];
```

Read the selected tab in the component:
```typescript
private route = inject(ActivatedRoute);
readonly selectedTab = toSignal(this.route.data.pipe(map(d => d['selectedTab'])));
```

A tab route that needs its own guard carries it and its `data` keys on that route alone.

## Step 7 — Register route artifacts

When creating, extracting or registering a route target component, read `{CURSOR}/skills/client-angular-component/scaffolding.md`. It owns role placement, architecture selection, imports, declarations and exports. Declarations never go in the routing module.

## Verification scope

Verify changed navigation, route data and registration through the applicable existing coverage and owning app build. For hydration or pending-write changes, use the required tests in [guards.md](guards.md).

## Common mistakes

| Mistake | Fix |
|---|---|
| `RouterModule.forRoot(routes)` in a feature routing module | Feature routing always uses `RouterModule.forChild(routes)` |
| Declarations in the routing module, or a standalone target in `declarations` | Use the architecture-aware registration in component scaffolding |
| Importing guards from deep relative paths | Import through the guard library's path alias |
| Route `data` missing or misspelling a key a guard reads | Read the guard and match its `data` shape |
| Forgetting `<router-outlet>` in parent component template | Required when using `children: []` |
| Reading route data through an input when the router does not enable `withComponentInputBinding()` | Use `inject(ActivatedRoute)` with `toSignal()` or `route.data` |
| Expecting a route to create a menu entry | Add the entry where the app's navigation is defined |
| Child guard waits on a component-owned NgRx load | Move hydration to a parent `canActivate` guard and remove the component dispatch |
| Matching the base href against `Router.url` | Use the app-relative path; the prefix belongs on plain `href` and server-provided URLs only |
| Guard cancels navigation on any pending write | Scope the cancel to the same routed entity via app-relative `Router.url`; return `false`, not a redirect `UrlTree` |
