# Component templates and rendered dependencies

## Template dependency audit

Inventory every non-native component, directive, pipe and bound input added to the template. Find the owning Angular module or standalone declaration from a working usage or package export.

- For `standalone: false`, add dependencies to the declaring feature `NgModule.imports`.
- For standalone components, add them to `@Component.imports`.
- Do not assume a sibling module from the same package re-exports them.
- With Kendo UI for Angular, `button[kendoButton]` and `[svgIcon]` require `ButtonModule` from `@progress/kendo-angular-buttons`; `DropDownButtonModule` does not provide them.

If an app's tsconfig sets `strictTemplates: false`, a build can pass while an unknown directive remains an inert native element. A focused spec claiming third-party UI behavior must import the real dependency and assert framework-rendered output, not merely a native click, disabled or ARIA attribute. TestBed imports/declarations follow the production architecture; skill `unit-test-guidance` owns test mechanics.

## data-qa-id placement

This section and the next apply when the codebase tags elements for tests. Use the attribute it already uses (`data-qa-id`, `data-testid`, `data-cy`); `data-qa-id` here stands for it.

Tag the component root and elements carrying behavior: the node the user acts on (button, link, input, checkbox, select, tab, menu item or a separate icon that opens a control). Repeated actions get an indexed id on that action node.

With no single outermost element, put the root id on the main content host (for example the grid's loading container), leaving sibling headers untagged. With only a trigger and detached overlay at top level, tag the trigger with its behavior id and the overlay content with a root id. Do not add a wrapper merely for an id.

Leave static text, labels, headings, decorative icons, layout wrappers and children inside an already tagged control untagged. An icon gets an id only when the user acts on it, or when it shows information or state that nothing else in the template shows (an info marker, a warning, a spinner, a check). Every other icon is decorative. Charts/tables/cards get an id only as the root or an actionable node. For static nodes, class and role queries remain valid.

Preserve existing IDs byte for byte, including ones that do not follow the current scheme; rule `client-component-conventions` owns base-branch freezing and current-change corrections. Set attributes inline; do not call an id helper in the template.

## data-qa-id naming

Name new ids the way sibling templates do; read a few to find the scheme. A common one is a type prefix plus a camelCase segment (`btn-saveWidget`, `chk-includeArchived`, `cnt-` for a root), with repeated actions suffixed by a 0-based index (`{id}-{index}`). A drop zone gets no id; use its file input.

When a shared UI library defines its own QA-id constants or QA-id input, keep them. When a feature hosts such a component, pass the id through that input so the rendered id is the one a QA plan can cite. Do not replace the library's constants with inline ids.
