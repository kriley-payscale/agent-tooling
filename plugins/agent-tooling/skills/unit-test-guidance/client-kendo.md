# Kendo in component specs

## Kendo component gotchas

- Import the owning Kendo module for every directive or component whose behavior the spec exercises. `NO_ERRORS_SCHEMA` does not instantiate missing directives.
- Assert Kendo-rendered behavior, not only native element behavior. For `button[kendoButton]` with `[svgIcon]`, import `ButtonModule` and assert the button has `k-button` and contains `.k-svg-icon`.
- The Jest setup may not load `@testing-library/jest-dom`. Use `element.classList.contains('class-name')` unless a working sibling spec proves `toHaveClass` is available.
- Add `provideNoopAnimations()` when Kendo filter popups, chart internals, or animation-backed UI fail in TestBed.
- Specs that click `kendo-grid-column-chooser` (or other Kendo popup-backed controls) in jsdom must provide `POPUP_CONTAINER` with `{ nativeElement: document.body } as ElementRef`. Import `POPUP_CONTAINER` from `@progress/kendo-angular-popup`. `provideNoopAnimations()` alone is not enough.
- Kendo pager in Jest: the pager's `ngAfterViewInit` calls `getPropertyValue` on the result of `window.getComputedStyle`. jsdom provides it, but a Jest setup file that mocks `getComputedStyle` (a common global-mocks pattern) may return an object without that method; check the setup files. When the spec must exercise paging under such a mock, install the spy **before the first `detectChanges`** and restore it in `afterEach`. Omitting the pager is still correct when paging is not part of the task — prefer focused local sort/filter/row-display assertions then.

  ```typescript
  let getComputedStyleSpy: jest.SpyInstance;

  beforeEach(() => {
    getComputedStyleSpy = jest
      .spyOn(window, 'getComputedStyle')
      .mockReturnValue({ getPropertyValue: () => '' } as unknown as CSSStyleDeclaration);
  });

  afterEach(() => {
    getComputedStyleSpy.mockRestore();
  });
  ```

- When row assertions fail against a Kendo Grid that has data and sets `[scrollable]="'none'"`, remove that binding per rule `client-kendo-grid`.
- For a controlled Kendo editor that saves on change, the production rule is in `{CURSOR}/skills/client-angular-forms/kendo-and-custom-controls.md`. Use the real Kendo editor in the component regression test: assert `fixture.detectChanges()` does not throw, pending editors lack `k-disabled`, the selected value appears immediately, and duplicate pending changes emit once. Cover success reconciliation and failure rollback in the reducer/effects tests that own those transitions.
- For Chart state-data immutability, the production rule is rule `client-kendo-charts` (clone state-owned chart data). Keep a regression with frozen input arrays/point objects and the real Chart harness: assert equal values, distinct bound array/point references and no mutation of the originals during rendering/aggregation.
- Kendo Chart projected series children can be consumed into Kendo's configuration store and absent from `DebugElement` queries. Import `ChartModule`, query the real `ChartComponent`, assert series through `chart.configurationService.store.series`, and assert rendered DOM separately. Do not replace chart internals with schemas or stubs.
- Kendo Grid projected columns and column groups may be consumed as configuration and absent from `DebugElement` queries. Import `GridModule`, query the real `GridComponent`, inspect `grid.columns.toArray()`, filter for `ColumnGroupComponent`, and use each group's `childrenArray` when asserting group order, titles, locked state, or leaf fields. Assert rendered headers and cells separately through the DOM.
- For Kendo Grid Excel export, import `ExcelModule` from `@progress/kendo-angular-grid`. `<kendo-grid-excel>` is an empty configuration component and may not be queryable through `DebugElement`; do not use `By.directive(ExcelComponent)` or `By.css('kendo-grid-excel')` to prove `[fetchData]` wiring. Spy on the bound callback, subscribe to `GridComponent.excelExport`, call `preventDefault()`, trigger the production path that invokes `GridComponent.saveAsExcel()`, and assert the callback received that Grid plus the workbook data-row count and order.
