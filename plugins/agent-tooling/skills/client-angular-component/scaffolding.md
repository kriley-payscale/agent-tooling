# Component creation, extraction and registration

Apply the architecture section in [SKILL.md](SKILL.md) before choosing declarations or imports.

## Read and place

Read a same-role, same-suffix sibling from the target collection before writing. Use the suffix same-role siblings use: `.page.ts` for a page where the codebase has page files, `.component.ts` otherwise. Role decides `containers/` versus `components/` per rule `client-component-conventions`.

Decide the rest by whether the choice is visible outside the file. Page folder location, a per-component `index.ts` and grouping depth follow the same-role siblings in the target collection. Code style inside the new file follows its artifact rule, not its neighbors. When the siblings disagree or the collection is empty, as in a new feature module, use the default: place each bundle directly under the nearest meaningful collection, and a grouping folder needs at least two sibling exportable concepts.

Match the siblings' template and style placement; use `styleUrls` only when the component owns styles, and never create an empty stylesheet.

For a new component in an ordinary NgModule feature:

```typescript
@Component({
  selector: 'app-my-feature',
  templateUrl: './my-feature.component.html',
  styleUrls: ['./my-feature.component.scss'],
  standalone: false
})
export class MyFeatureComponent {}
```

For an intentionally style-free component, omit `styleUrls`. Use the selector prefix configured for the project (`prefix` in `project.json` or `angular.json`, enforced by `@angular-eslint/component-selector`), never a bare name.

## New shared UI library components

Follow a standalone sibling in the library and the library's ESLint configuration: its selector prefix, change-detection convention, external template/styles, and the applicable direct export in the library's public `index.ts`. Standalone may be implicit in the installed Angular (the default from v19); preserve the library's explicit/implicit decorator style. Do not force `standalone: false` to match an app example. Preserve the library's QA-id constants and inputs.

## Registration and exports

For a non-standalone artifact, add it to the feature module's `declarations`, never the routing module. Audit the template dependencies using [templates.md](templates.md); those dependencies belong in that feature module's `imports`.

In TestBed, standalone artifacts belong in `imports` and non-standalone artifacts in `declarations`, with real dependencies in `imports`; skill `unit-test-guidance` owns test mechanics.

Component barrels, sibling and spec import paths, and renames or moves follow rule `client-barrel-exports`. For other roles:

- Import pages by concrete path from routing/module files unless the feature already has a page barrel.
- Containers follow the nearest existing convention; do not create an aggregate barrel solely for one container.
- Existing local barrels inside a library can remain; new public library exports use the direct export above.

## Extracting a region

Extract when the region has meaningful independent logic or a reusable rendering boundary. A large parent (roughly 200+ TS lines) is a reason to inspect its responsibilities, not a requirement to split.

1. Classify the child and decide which Store reads, dispatches, inputs and outputs move with it, per rule `client-component-conventions` ("Choose the role before the folder"). A presentational region can accept its primary data through `input.required<T>()`.
2. Keep Router/navigation orchestration in a page/container; presentational children emit navigation intent.
3. Move the region's methods and local signals and remove their obsolete parent copies. Preserve validation, loading/error handling, and cleanup.
4. Register/export according to the child's architecture. Update callers, parent and child specs, imports and fixture contracts together: remove former parent emit/handler assertions and assert child dispatches where the write now lives.
