# Route guards

## Guard-dependent route hydration

Angular completes parent and child guards before it instantiates routed components. A guard must never wait for NgRx state whose load is dispatched by a component blocked behind that guard; the component constructor and `ngOnInit` are both too late.

When a child guard needs route-owned entity state:

1. Put a hydration `canActivate` guard on the parameterized parent route.
2. Validate the route ID before dispatching.
3. Reuse state only when the loaded entity ID exactly matches the route ID.
4. Otherwise dispatch the existing load action and wait for that exact entity or a terminal load error.
5. Let child guards evaluate workflow access only after parent hydration completes.
6. Remove the same load from the layout component to avoid duplicate requests and state resets.

```typescript
{
  path: 'orders/:orderId',
  component: OrderLayoutComponent,
  canActivate: [OrderHydrationGuard],
  children: [
    {
      path: 'lines',
      component: OrderLinesPageComponent,
      canActivate: [OrderStepGuard]
    }
  ]
}
```

The parent guard coordinates existing NgRx state; it does not call the API directly:

```typescript
canActivate(route: ActivatedRouteSnapshot): Observable<boolean | UrlTree> {
  const id = Number(route.paramMap.get('orderId'));
  if (!Number.isSafeInteger(id) || id <= 0) return of(this.router.createUrlTree(['/orders']));

  return this.store.select(selectOrder).pipe(
    take(1),
    switchMap(order => {
      if (order?.id === id) return of(true);

      this.store.dispatch(loadOrder({ id }));
      return combineLatest([
        this.store.select(selectOrder),
        this.store.select(selectOrderLoading),
        this.store.select(selectOrderLoadError)
      ]).pipe(
        filter(([current, loading, error]) =>
          !loading && (current?.id === id || error)
        ),
        take(1),
        map(() => true) // The layout renders the recoverable error state.
      );
    })
  );
}
```

Do not substitute a resolver while a child guard still needs the data: Angular finishes guards before running resolvers.

On load failure, return `true` only when the routed layout owns a recoverable error state. Otherwise return an explicit `UrlTree`. Never authorize from stale state belonging to a different route ID.

Keep ordinary component-owned loading when no guard consumes that state. Route hydration is needed only when activation depends on the data.

Required tests:
- Cold deep link: entity `null`, loading `false`, no error
- Matching entity already loaded: no duplicate dispatch
- Stale entity from another route ID
- Loading success and API failure terminal states
- Missing, nonnumeric, non-positive, fractional, and unsafe-integer route IDs
- Direct entry to every guarded child route and disabled-step redirects
- Layout test proving the component no longer dispatches the hydration load

## Guards that cancel navigation while writes are in flight

A guard that cancels navigation while writes are pending must cancel only navigation that starts inside the same routed entity. Compare the current app-relative `Router.url` with that entity's path: match the id as a whole segment and ignore query and fragment.

Why: in-flight counters are often kept across entity resets on purpose, so a late response can still settle. An unscoped cancel then silently blocks entering a different entity, or re-entering from a list page, until an unrelated write settles.

Return `false` for the busy case, not a redirect `UrlTree`. A redirect computed from the furthest allowed step resolves to the first step when every step is disabled.

```typescript
private isNavigatingWithinEntity(entityId: number): boolean {
  const currentPath = this.router.url.split(/[?#]/)[0];

  // Trailing slash makes the id a whole segment: /items/21/ does not match /items/210/...
  return currentPath.startsWith(`/items/${entityId}/`);
}

canActivate(route: ActivatedRouteSnapshot): Observable<boolean | UrlTree> {
  const entityId = Number(route.parent?.paramMap.get('itemId'));

  return this.store.select(selectWritesPending).pipe(
    take(1),
    switchMap(writesPending =>
      writesPending && this.isNavigatingWithinEntity(entityId)
        ? of(false)
        : this.canActivateStep(route, entityId)
    )
  );
}
```

Required tests:
- Same entity with writes pending: navigation cancelled
- List page to entity with writes pending: allowed
- Different entity with writes pending: allowed
- Id that is a numeric prefix of another id (for example `21` vs `210`): does not match
