# Loading and load-error display

Find the codebase's loading container first, if it has one: a shared component that takes a loading flag and masks the content it wraps (search the shared UI library for a component with a `loading` input). These rules apply to it, and to a Kendo Grid's own `[loading]`.

## Loading ownership

The template that owns the content an API response will replace owns its loading wrap. Keep the wrapper mounted and bind its loading flag to that in-flight reload (page, query or filter changes replacing rows). If the child is a `kendo-grid`, bind the same flag to the Grid's `[loading]`. Do not mount the wrapper only while loading.

If the container's mask is absolutely positioned, its host needs `position: relative`, or the mask paints over the app shell. Do not use a full-screen or page-level mask for an in-place refresh.

Do not replace updating content with a standalone loader, status-only wrapper or page blanket. Do not mount a contentless loading container or add a page wrap around a child that already wraps.

- First load, with no updating body, whose response unmounts existing empty or placeholder copy: wrap that copy.
- A page's bootstrap load, with no page body rendered yet: a dedicated loading region is allowed. This is distinct from updating a grid.
- Saving or disabling one row is not a reload: do not overlay the whole Grid for it.
- A mutation that replaces the body: bind a feature-level busy selector, not a per-child OR of every save flag.

## Reload failures

When a reload retains existing content, its failure message must be visible while that content is present. Do not put the only error indication in a Grid no-records template or another empty-only branch. Plan and verify a successful load followed by a failed page, filter or refresh request, asserting a visible error with the retained rows still present. An initial-load failure case does not cover this transition.

## Chained first-load requests

Compose one pending flag for every empty-response section needed for first paint; keep one loader mounted until all settle. Unhiding a later section on the first success mounts another loader and flashes a second spinner. Keep retained-content refresh out of this first-paint flag.

```typescript
readonly sectionPending = computed(() =>
  isFirstLoadPending(this.primary()) || isFirstLoadPending(this.secondary())
);
```

`isFirstLoadPending` stands for a check that the section has never loaded and its request is in flight.
