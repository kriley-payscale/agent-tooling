# agent-tooling plugin

Cursor rules, skills and agents for codebases built with Angular (and NgRx, Nx and Kendo UI where a repository uses them), ASP.NET Core with EF Core, and SQL Server, plus Tilt-based local environments. The plugin carries planned work from discovery to verified commits, reviews and opens pull requests, and checks its work against your local API, database and browser.

- Install: [INSTALL-LOCAL.md](INSTALL-LOCAL.md)
- Use: [USAGE.md](USAGE.md)
- Change: [authoring standards](../../CONTRIBUTING.md) and [tooling proposals](../../proposals/README.md)

## What's in it

| Folder | Holds |
|---|---|
| `rules/` | Conventions that attach when a request matches their description: `client-*` (Angular, NgRx, Nx, Kendo UI), `dotnet-*` (ASP.NET Core, EF Core), `tilt-*`, the plan workflow (`plan-workflow`, `plan-task-schema`) and the core rules (`read-before-write`, `scope-creep-gate`, `path-token-resolver`, `environment-resolver`) |
| `rules/skill-shims/` | One rule per skill, routing a matching request to it |
| `skills/` | Step-by-step procedures: Angular components, feature modules, forms, routes and NgRx slices; .NET controllers, services, data access, EF query optimization and endpoint profiling; SQL objects, data scripts and queries; unit tests; server-side pagination; the plan workflow; PR review and opening; local API calls |
| `agents/` | Roles the plan workflow delegates to: discovery, planning, one implementation agent each for `client`, `dotnet` and `sql`, and browser verification |
| `commands/` | `agent-tooling-setup` |
| `scripts/` | Setup and the session-start runtime, the guidance checker and the proposal submitter, with their tests |

## Workspace model

The workspace root is the folder that holds your repositories. It is never a repository: setup refuses a root that contains `.git` or sits inside a folder that does. Everything the plugin writes goes under `<root>/.cursor/agent-tooling/`, so it never writes inside a repository.

Roles tell the plugin where each kind of code lives. Each role is a folder relative to the root, kept in `<root>/.cursor/agent-tooling/agent-tooling.local.json`:

| Role | Token | Folder that holds | Detected by |
|---|---|---|---|
| `client` | `{CLIENT}` | The Angular workspace | `angular.json`, or `nx.json` beside a `package.json` that depends on `@angular/core` |
| `dotnet` | `{DOTNET}` | The .NET solution, or the project when there is no solution | A `.sln` or `.slnx` file; when no folder has one, a `.csproj` |
| `sql` | `{SQL}` | A database schema source kept apart from the .NET code, such as a SQL project or a scripts repository | Never detected; set it yourself |
| `tilt` | `{TILT}` | The root `Tiltfile` | A `Tiltfile` |

A role can point at a whole repository or a folder inside one, and several roles can share a repository. Each role has one folder, so two repositories with the same role, such as two .NET APIs, aren't supported. Leave out roles your code doesn't have.

Leave `sql` unset when the schema lives in EF Core migrations or migration scripts inside the .NET solution's folder. That code belongs to `dotnet`, whose agent writes it with the SQL guidance; a `sql` folder inside `{DOTNET}` would hand migrations to an agent that can't generate them.

### Layouts

Several sibling repositories:

```text
~/src/acme/              workspace root, not a repository
├── web/                 Angular repository (angular.json)
├── api/                 .NET repository (Acme.sln)
├── database/            database schema repository
└── infra/               repository with the Tiltfile
```

```json
"roles": { "client": "web", "dotnet": "api", "sql": "database", "tilt": "infra" }
```

One monorepo holding several roles:

```text
~/src/acme/              workspace root
└── acme/                the repository, Tiltfile at its root
    ├── web/             angular.json
    ├── server/          Acme.slnx
    └── db/              database schema
```

```json
"roles": { "client": "acme/web", "dotnet": "acme/server", "sql": "acme/db", "tilt": "acme" }
```

A single repository:

```text
~/src/acme/              workspace root
└── acme-api/            the repository (AcmeApi.sln)
```

```json
"roles": { "dotnet": "acme-api" }
```

`sql` is always set by hand; setup detects the rest. The generated workspace file opens the tooling folder and each role's repository once, so a monorepo shows up as one folder.

### First run and later runs

Every setup run looks for the markers in the root and up to three folders below it. It follows symlinked folders, so repositories linked into the root count, and skips `.git`, `.cursor`, `node_modules`, `bin`, `obj`, `dist` and other tool and build-output folders. For each role the shallowest match wins; a folder with a `.csproj` counts for `dotnet` only when no folder has a solution. The first run writes what it finds to `roles`. When several folders match at that depth, setup leaves the role unset and its output names the candidates:

```text
dotnet: several folders could hold the dotnet role (billing, orders). Set roles.dotnet in <config file> to the one this workspace works in.
```

`sql` is never detected. Use a root that holds only the repositories this workspace works on, so detection doesn't find unrelated ones.

After the first run, `roles` is yours: later setup runs never change it. They refresh tool paths and repeat the warning above for each unset role that several folders could hold. They don't mention a role that has since become detectable in one folder, so add it yourself. The warning is in setup's output, not in a chat's snapshot.

Edit `roles` by hand to add `sql`, settle an ambiguous role or move a folder. The workspace file is written only when it's missing, so then delete `<root>/.cursor/agent-tooling/agent-tooling.code-workspace`, rerun the install command or `/agent-tooling-setup` so the workspace opens the right folders, reopen the workspace and start a new chat.

A configured role whose folder is missing is left out of `paths` with a warning. Only that role's work is blocked:

```text
client: <folder> is not a folder, so work for this role is blocked. Point roles.client in <config file> at the folder that holds it.
```

### Path tokens

Guidance writes paths as tokens, which agents resolve from the runtime snapshot:

| Token | Resolves to |
|---|---|
| `{CURSOR}` | The plugin folder, `plugins/agent-tooling` in your clone |
| `{WORKSPACE}` | The workspace root |
| `{ARTIFACTS}` | `{WORKSPACE}/.cursor/agent-tooling`: configuration, plans, reviews and evidence |
| `{CLIENT}`, `{DOTNET}`, `{SQL}`, `{TILT}` | Each configured role's folder; absent when the role isn't configured or its folder is missing |

### Runtime snapshot

When a chat starts, a hook adds `AGENT_TOOLING_RUNTIME` followed by a JSON snapshot to its context:

| Field | Holds |
|---|---|
| `status` | `ready`; `setup-required` when no configuration is found in or above the open folders; or `error` |
| `message` | What the status means, or the error |
| `paths` | The token values |
| `configFile` | The configuration file |
| `tools`, `missingTools` | Each tool's path, `null` when not found or not runnable, and the list of those |
| `warnings` | Missing tools, missing role folders and an empty `roles`, each with its fix |

The always-on rules resolve tokens and tool paths from the snapshot, and skills pass it to the agents they delegate to. `ready` means the workspace is configured, not that every tool and role is available: read `missingTools` and `warnings`. An existing chat keeps the snapshot it started with, so start a new chat after any change. To print the snapshot outside a chat:

```bash
node "<plugin>/scripts/runtime.mjs" resolve --workspace "<workspace root>"
```

## Tools

Setup records the paths of `dotnet`, `sqlcmd` and `rg` in `tools`.

- **It only looks.** It never installs tools, runs builds, tests a database connection or reads credentials.
- **Where it looks:** your `PATH` first, then `~/.dotnet/tools`, `~/.dotnet` and `DOTNET_ROOT`. On macOS, Homebrew (`HOMEBREW_PREFIX`, `/opt/homebrew`, `/usr/local`, including `opt/mssql-tools18/bin`) and `/usr/local/share/dotnet`. On Windows, `dotnet` under Program Files and `sqlcmd` under `Program Files/Microsoft SQL Server/Client SDK/ODBC/<version>/Tools/Binn`. For `rg`, also the copy bundled with Cursor.
- **Refreshing.** `/agent-tooling-setup`, or `runtime.mjs setup`, replaces a path setup detected itself (recorded in `discoveredPaths`) when that path stops working and another is found. A path you typed in yourself is kept even when it's broken; set it to `null` and rerun setup to have setup look again. Rerunning `workspace.mjs` on a configured workspace doesn't refresh tools or repeat role warnings.
- **A missing tool blocks only the work that needs it.**
- **Keep the configuration local.** It holds machine-specific paths. Don't commit it or put credentials in it.

## Troubleshooting

### 1. See what setup found

Rerun setup and read `tools`, `missingTools` and `warnings`. Use your clone's plugin folder (`paths.CURSOR`) and your workspace root:

```bash
# macOS
node "$HOME/src/agent-tooling/plugins/agent-tooling/scripts/runtime.mjs" setup --project-dir "$HOME/src/acme"
```

```powershell
# Windows
node "C:/src/agent-tooling/plugins/agent-tooling/scripts/runtime.mjs" setup --project-dir "C:/src/acme"
```

To check without writing anything, use `resolve --workspace "<workspace root>"` in place of `setup --project-dir "<workspace root>"`.

A healthy configuration on macOS (`null` means not found):

```json
{
  "roles": { "client": "web", "dotnet": "api", "tilt": "infra" },
  "tools": {
    "dotnet": "/usr/local/share/dotnet/dotnet",
    "sqlcmd": "/opt/homebrew/bin/sqlcmd",
    "rg": "/opt/homebrew/bin/rg"
  },
  "discoveredPaths": { "dotnet": "/usr/local/share/dotnet/dotnet", "sqlcmd": "/opt/homebrew/bin/sqlcmd", "rg": "/opt/homebrew/bin/rg" },
  "pluginPath": "/Users/<you>/src/agent-tooling/plugins/agent-tooling"
}
```

On Windows, setup writes escaped backslashes (`"C:\\Program Files\\dotnet\\dotnet.exe"`). When you edit a path by hand, use forward slashes: `"C:/Program Files/dotnet/dotnet.exe"`.

### 2. Errors and warnings

Errors appear in the snapshot's `message` with `status: "error"`, or on the terminal when you run a script.

| Message | Fix |
|---|---|
| `The workspace root must be the folder that contains your repositories, not one inside a repository: <root> is in <repository>. Use the folder that contains that repository.` | Pass the folder that holds the repository, not the repository or a folder in it. |
| `Usage: workspace.mjs --project-dir <workspace root> [--plugin-dir <local agent-tooling plugin>]` | Spell the flags as shown and pass absolute paths. |
| `No agent-tooling.local.json found. Run the agent-tooling-setup command and select the folder that contains your repositories.` (`status: "setup-required"`) | The open folders aren't under a configured root. Open the generated workspace file, or run setup. |
| `Workspace roots resolve to multiple agent-tooling configurations: <roots>` | The window has folders from two workspace roots. Open each root's workspace file in its own window. |
| `None of the workspace roots is an existing folder: <roots>` | Every folder the window has open, or every `--workspace` path, is missing; a missing folder beside existing ones is skipped. Fix the path, or the moved folder's entry in the workspace file. |
| `Invalid JSON in <file>` | Usually a single backslash in a hand-edited Windows path. Use forward slashes. |
| `Invalid agent-tooling configuration structure: <file>` | A key was deleted or added. Keep `roles` and `tools` as objects and all three `tools` keys (`null` when unknown); the only other keys are `discoveredPaths` and `pluginPath`. |
| `Unknown role <role> in <file>; roles are client, dotnet, sql, tilt` | Rename or remove the role. |
| `roles.<role> must be a folder relative to the workspace root, without "..", in <file>` | Use a path such as `"web"` or `"acme/web"`, never an absolute path, a Windows drive-relative path such as `"C:web"`, or one that leaves the root. |
| `<tool> must be an absolute path or null in <file>` | Fix the path, or set it to `null` and rerun setup. |
| `Refusing to overwrite existing workspace file: <file>` | A file under `.cursor/agent-tooling/.cursor/` differs from what setup writes now (you edited it, or a plugin update changed it), or a destination is a symlink. Delete that file and rerun the install command. |
| `Refusing to overwrite existing pluginPath in <file>` | `pluginPath` points at another plugin folder, for example after you moved the clone. Set it to the clone's `plugins/agent-tooling` folder, or remove it and rerun the install command. |
| `Expected an absolute pluginPath in agent-tooling.local.json` (from the workspace's hooks, in Cursor's **Output** panel) or `pluginPath must be an absolute path in <file>` | `pluginPath` is missing or not absolute. Remove a bad `pluginPath` and rerun the install command. |
| `Expected the agent-tooling plugin` | `--plugin-dir` or `pluginPath` isn't the clone's `plugins/agent-tooling` folder. |
| `Expected local directory without a symlink: <path>` or `Expected local file without a symlink: <path>` | Something setup writes under `<root>/.cursor/` is a symlink, or a file where a folder belongs. Replace it with a real folder or file. |
| `agent-tooling requires Node.js 20 or newer` | Install Node.js 20 or newer, then fully quit and reopen Cursor. |
| Warning: `<role>: <folder> is not a folder, so work for this role is blocked. ...` | Point the role at an existing folder, or remove it. |
| Warning: `No roles are configured. ...` | Set `roles`; see [Workspace model](#workspace-model). |
| Warning (setup only): `<role>: several folders could hold the <role> role (<folders>). ...` | Set that role in `roles` to the folder this workspace works in; see [First run and later runs](#first-run-and-later-runs). |

### 3. A tool is missing

Usually the tool is installed but setup can't see it.

| Symptom | Fix |
|---|---|
| Found in your terminal, `null` in setup | Cursor still has the `PATH` from before the install. **Fully quit Cursor** (Reload Window is not enough), reopen it and rerun setup. |
| Installed somewhere setup doesn't look | Put its absolute path in `tools` and start a new chat. |
| Still wrong after reinstalling | Paths you typed in are kept. Set the entry to `null` and rerun setup. |

To see what your own terminal finds: `where.exe dotnet sqlcmd rg` on Windows, `command -v dotnet sqlcmd rg` on macOS.

Install only what your work needs, then fully quit and reopen Cursor and rerun setup:

| Tool | Needed for | Windows | macOS |
|---|---|---|---|
| `dotnet` | .NET builds and tests | `winget install Microsoft.DotNet.SDK.<major>` | `brew install --cask dotnet-sdk` |
| `sqlcmd` | SQL queries and database checks | `winget install Microsoft.Sqlcmd` | `brew install sqlcmd` |
| `rg` | Code search; usually found inside Cursor | `winget install BurntSushi.ripgrep.MSVC` | `brew install ripgrep` |

For `dotnet`, install the SDK version that matches `TargetFramework` in your .NET projects.

### 4. The plugin doesn't load

- Open Cursor through `<root>/.cursor/agent-tooling/agent-tooling.code-workspace`. Opening a repository folder directly loads nothing.
- Check that `<root>/.cursor/agent-tooling/.cursor/hooks.json` exists and that `pluginPath` in the configuration points at the clone's `plugins/agent-tooling` folder.
- Look for hook errors in Cursor's **Output** panel, under **Hooks** and **Cursor Plugins**.
- In **Cursor Settings → Plugins**, **Agent Tooling** should be listed once.
- Reload the window and start a new chat after any change.

### 5. Ask an agent

In a new Agent chat in the workspace:

```text
Read AGENT_TOOLING_RUNTIME from startup context. For each entry in missingTools, without installing or editing anything:
1. Check whether it resolves in your terminal (where.exe or Get-Command on Windows, command -v on macOS) and show your PATH.
2. Search this OS's usual install folders (Program Files, %LOCALAPPDATA%, ~/.dotnet/tools, Homebrew, Cursor's install folder) for the executable.
3. Run the version command of anything found.
Recommend the smallest fix per tool: restart Cursor, set an absolute path, set it to null and rerun setup, or install it (give the command). Write the findings to {ARTIFACTS}/setup-diagnostics/tools.md.
```

```text
AGENT_TOOLING_RUNTIME has status "error". Quote its message, find the check that raised it in the plugin's scripts/runtime.mjs, and tell me exactly what to change. Do not edit anything.
```
