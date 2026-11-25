# Contributing

What every change to `plugins/agent-tooling/` must meet, whoever writes it.

## Who changes what

- **Guidance** (rules, skills, agents, commands): [propose the change](proposals/README.md). The plugin owner's promotion PR applies accepted proposals and moves them to `resolved/` in the same PR.
- **Scripts** (`scripts/`, `skills/*/scripts/`, `hooks.json`, `.cursor-plugin/plugin.json`): direct PRs to `main`.

Edit in your clone ([INSTALL-LOCAL](plugins/agent-tooling/INSTALL-LOCAL.md)). Cursor runs the clone's working tree, so try a change in a new chat first, and use a `git worktree` for branches you aren't running.

## Kinds of guidance

| Kind | Holds | Loaded |
|---|---|---|
| Rule (`rules/<name>.mdc`) | Conventions that hold whenever a kind of file or task is touched | When a request matches its `description`, or in every session with `alwaysApply: true` |
| Skill (`skills/<name>/SKILL.md`) | A procedure for one task, step by step | Through its shim, a rule that names it, or `/<name>` in chat |
| Leaf (`skills/<name>/<topic>.md`) | Detail only some runs of the task need | When its row in the skill's guidance map applies |
| Agent (`agents/<name>.md`) | A delegated role in a multi-agent flow | By the skill that dispatches it |
| Command (`commands/<name>.md`) | A procedure the user starts as `/<name>` | When the user runs it |

Prefer adding to the rule or skill that already owns the topic. Split out a leaf when a section applies only to some cases. A fact has one home; elsewhere, point to it (rule `<name>`, skill `<name>`, or a `{CURSOR}/…` path and section) instead of restating it.

## Shims

A skill sets `disable-model-invocation: true` and gets a shim, `rules/skill-shims/<name>.mdc`: a rule whose description carries the skill's trigger and whose body is ``Read `{CURSOR}/skills/<name>/SKILL.md` for the full step-by-step procedure.`` The checker fails a shim without its skill, and a shimmed skill without `disable-model-invocation: true`, which would list it twice. A skill reached only through a companion rule that names it, such as `client-angular-component` through `client-component-conventions`, has no shim.

## Frontmatter

- `description` is one line, never a `>` or `|` block, quoted when it contains a colon, and starts with "Use when". Name the task and the files it touches, so it attaches to the right work and not to every edit.
- Skills, agents and commands have `name` equal to their folder or file name.
- `alwaysApply: true` is only for rules every session needs, today `path-token-resolver` and `environment-resolver`. Every other rule relies on a precise description and has no `globs`: Cursor doesn't list a glob rule as requestable, and plugin glob rules did not attach to matching files.

## Guidance maps

A rule, skill or agent that sends readers to other files does it in one `## Guidance map` section: a `| When | Read |` table placed directly after the title and opening lines, before any procedure.

- A skill with leaves has the map as its first `##` section and names every leaf in the Read cell of exactly one row. The checker enforces both.
- `When` is a condition the reader can observe from the task or an event: a kind of file changing, an error, a step reached. State it positively. If something shouldn't trigger the read, tighten the condition instead of adding "skip when" text.
- `Read` holds file references only: a relative link to a leaf, rule `<name>`, skill `<name>` or a `{CURSOR}/…` path.
- A leaf needed only after something happens mid-procedure is also named at that step, in its row's words. The leaf doesn't restate its own condition.

## Content

- **Patterns, not product details.** No product, feature or team names, ticket ids, feature file paths or incident anecdotes. Guidance must hold for any codebase on the supported stack. Grep your text for the names of the task you learned it on before saving.
- **Find the codebase's own version.** When guidance depends on a codebase type or convention, give the pattern and how to find the local equivalent (what to search for), then the framework default when there is none. Style follows the existing code; rules that protect correctness stay prescriptive.
- **Examples** use obvious placeholders: `MyFeature`, `Widget`, `IMyFeatureService`, `FooRepository`, `NewTable`, and `TenantId` where tenant scoping matters.
- **Paths** use tokens so they resolve on every machine: `{CURSOR}/…` for plugin files, `{CLIENT}`, `{DOTNET}`, `{SQL}` and `{TILT}` for code, `{WORKSPACE}` for the workspace root and `{ARTIFACTS}` for generated files.
- **Branches.** Write "the integration branch": the repository's default branch unless the task names another.
- **Windows and macOS.** Every script and command must work on both. Put multi-step shell logic in a Node script beside the skill (`skills/<name>/scripts/*.mjs`, with a `*.test.mjs`) rather than a bash pipeline. Shell fences use POSIX syntax; rule `environment-resolver` translates them for PowerShell.
- **Say when, then what.** Lead with the condition ("When a write method…"), state the rule, and give the reason only when the next edit would otherwise undo it.

## Size

A guidance file (any `.md` or `.mdc` under `rules/`, `skills/`, `agents/` or `commands/`) may be at most 12 KB: 12,288 bytes, counting CRLF line endings as LF. A file that was already over the budget where your branch left `origin/main` may shrink but not grow, so cut as much as you add, or split it into leaves.

## Checks

Run both before pushing:

```bash
node plugins/agent-tooling/scripts/check-guidance.mjs
node --test "plugins/agent-tooling/**/*.test.mjs"
```

CI runs both on every PR to `main`, on Ubuntu and Windows with Node 22. The checker prints each problem with its file and ends with `Guidance checks passed` or a problem count. It compares sizes with where your branch left `origin/main`, so without that ref it stops with `origin/main not found; run git fetch origin main`.

Under `plugins/agent-tooling/` it checks:

- **Frontmatter:** a single-line `description` on every rule, skill, agent and command; `name` matching the folder or file; `alwaysApply` set to `true` or `false` when present.
- **Shims:** each has its skill, and that skill has `disable-model-invocation: true`.
- **Guidance maps** in skills that have leaves.
- **Paths:** a brace token used as a path root is one of `{CURSOR}`, `{WORKSPACE}`, `{ARTIFACTS}`, `{CLIENT}`, `{DOTNET}`, `{SQL}` and `{TILT}`, and every `{CURSOR}/…` target exists.
- **Links:** relative Markdown links outside code resolve.
- **Size:** the budget above.
- **JSON:** every `.json` and `.code-workspace` file parses.
- **Proposals:** each file in `proposals/agent-tooling/pending/` passes the [proposal checks](proposals/README.md#template).
