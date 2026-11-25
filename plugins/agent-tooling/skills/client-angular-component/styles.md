# Component styles and design-system reuse

Run commands from `{CLIENT}`.

## Find the design system

The design system is a shared UI library in the workspace (under `libs/` in Nx, `projects/` in an Angular CLI workspace) or a UI package in `package.json` dependencies: components sharing a selector prefix, often with a styles folder of mixins and global classes, and a tokens or variables file (CSS custom properties in a `:root` or root-class block, or SCSS variables). The app's `styles` and `stylePreprocessorOptions.includePaths` build options (`project.json` or `angular.json`) show which stylesheets and partial folders it loads. With `ROOTS` the library's folder (under `node_modules` for a package), those folders and the app's own source root, find candidates:

```bash
grep -rlE -- '^ *--[a-z0-9-]+ *:' $ROOTS --include='*.scss' --include='*.css' | head
grep -rl '@mixin' $ROOTS --include='*.scss' | head
```

With `UI` the library root, `STYLES` its styles folder and `TOKENS` its tokens file, list what exists:

```bash
# Components
grep -rhoE "selector: '[^']+'" $UI --include='*.ts' | sed -E "s/selector: '([^']+)'/\1/" | sort -u
# Global classes
grep -rhoE '^ {0,2}\.[a-z][a-z0-9-]+' $STYLES --include='*.scss' | tr -d ' ' | sort -u
# Mixins
grep -rhoE '@mixin [a-z0-9-]+' $STYLES | sed 's/@mixin //' | sort -u
# Tokens
grep -hoE -- '^ *--[a-z0-9-]+' $TOKENS | tr -d ' ' | sort -u
```

Some tokens are generated (for example a spacing scale emitted by a Sass loop over a map) and do not appear literally; read the generator. Take token values from the source files, not the library's README, which can be stale. With no design system, the ladder below starts at layer 3.

## Style reuse ladder

Determine the style context first (below). A design system whose stylesheet loads globally applies everywhere. One that scopes its classes, mixin output and `var(--…)` tokens under a root class or wrapper component that loads its stylesheet applies only inside it; the app shell's content area can be outside it, and a component rendered to `<body>` (a dialog opened through a service, or a modal or popup appended to the body) is outside every such root. Bring a region into a scoped design system the way existing pages do, usually with the library's wrapper component; a bare root class depends on some other wrapper having loaded the stylesheet. Outside the design system's context, use what that region already uses: Bootstrap, global SCSS variables and the app's own styles.

Before writing new component SCSS or a new visual element, list what exists (above) and check the library for each element type: buttons, badges and status labels, card surfaces, focus indicators, form fields and labels, switches and combo boxes, banners and empty states, modals, drawers, tabs and steppers, page and flex layout, text styles and shadows. Then take the first layer that reproduces the design exactly. Layers 1, 2 and 5 apply only in design-system context.

1. A design-system component that renders the element.
2. A design-system global class in the template, or a design-system mixin in SCSS (card surface, focus ring).
3. A utility class (Bootstrap utilities section, or the codebase's own utilities).
4. A shared feature class (below).
5. A token in component SCSS. Use only names the tokens file defines or generates. A `var()` with an undefined name silently uses its fallback or drops the declaration.
6. A raw value, only for fixed sizes with no token, or outside design-system context.

A raw value that equals a token is a defect: compare radii, font sizes, font weights, spacing and colors against the token scale. Prefer semantic color tokens (primary, error, body text, border, content background) over raw palette tokens.

When the design repeats a design-system pattern with one differing property, include the mixin or apply the class and override that property; do not redeclare the block. When nothing fits, write the SCSS and name the missing design-system piece in the task report or PR description.

Read a design-system component's inputs, and its README when one exists, before wrapping or restyling it. Pass its inputs rather than overriding its internals with `::ng-deep`.

- **Shared feature classes:** when a feature has a global stylesheet scoped to the feature's root class, that stylesheet owns the feature's shared classes. Keep them in one "Shared" section at the top of the root block, give them a short prefix that stands for the feature, and apply them in templates. Search that section before writing a card surface or text style in component SCSS. Add a class when a second component needs the same declarations. Do not add feature classes to the design-system library.
- **Scope:** shared classes apply only inside the feature's root element. A component rendered to `<body>` is outside that root and must keep its own SCSS.

## Bootstrap utilities

When the app loads Bootstrap utilities globally, use a utility class in the template instead of a component SCSS declaration when it produces the same value: display and flex (`d-flex`, `d-inline-flex`, `flex-column`, `flex-wrap`, `flex-fill`, `flex-shrink-0`, `align-items-*`, `justify-content-*`), `m-0`, `p-0`, `w-100`, `vh-100`, `position-*`, `overflow-hidden`, `text-nowrap`, `text-center`, `fw-normal`, `bg-transparent`, `border-0`, `list-unstyled`.

Keep in SCSS:
- px spacing and `gap` when the root font size is not 16px. Spacer utilities are rem-based, so they then match no px design value; check the root `font-size` in the global styles.
- font weights 500 and 600 when the installed Bootstrap has no matching `fw-*` class (5.1 has neither).
- colors, borders, shadows, radii and sizes. Take their values from the style reuse ladder.
- any property a BEM modifier overrides. Utilities are `!important`, so the modifier would lose.

Check the global stylesheets for overrides of utility classes before relying on them. An override such as `.d-flex { min-height: 0; }` lets an element that is itself a flex item in a height-constrained column shrink below its content.

Bootstrap's reboot already gives enabled buttons and `[role=button]` `cursor: pointer`; do not repeat it. Keep a BEM class while it carries rules or a spec/modifier hook; remove it once its rule is empty and nothing references it.

## Sass imports

Shared partials usually resolve through `stylePreprocessorOptions.includePaths` in `project.json` or `angular.json`. Dart Sass deprecates `@import`, but its deprecation warnings are not compiler failures.

Import a design-system mixin file when the style reuse ladder selects that mixin, and import only that file. Tokens are CSS custom properties and need no import. Otherwise add an import only for a needed shared value or mixin that has no token or local substitute. Never import the design system's global stylesheet into component SCSS: it re-emits the whole stylesheet into the component. Do not import a partial that depends on variables only its global entry sets.

## Determine the context

When the design system's stylesheet is global (listed in the app's `styles` build option, tokens on `:root`), every component is in its context. When it scopes its styles under a root class or wrapper, trace the component's host chain up to its routed page or overlay host; it is in context only when an ancestor template renders the library's wrapper component or root class:

```bash
grep -rlE '<wrapper-selector>|<root-class>' <app-root>/<feature>
```

A sibling that already uses `var(--…)` tokens is a hint, not proof. A body-portaled overlay is outside every root of a scoped design system, even when it is opened from a page in its context.

## Check before finishing

Raw values that equal a token, and hex colors in design-system context. Build the pattern from the token scale; with radius tokens at 4/8px, font sizes at 12/14/16px and weights 500/600:

```bash
grep -nE 'border-radius: *(4|8)px|font-size: *(12|14|16)px|font-weight: *(500|600)\b|#[0-9a-fA-F]{3,8}\b' <changed scss files>
```

`var()` names with no definition under `ROOTS` from "Find the design system" (exclude generated families, such as spacing):

```bash
grep -ohE 'var\(--[a-z0-9-]+' <changed scss files> | sed 's/var(//' | sort -u \
  | while read t; do grep -rqE -- "$t *:" $ROOTS || echo "undefined: $t"; done
```

A hand-written block for a button, badge, card surface or focus ring needs a reason the design system's version does not fit. State that reason, or the missing design-system piece, in the task report or PR description.
