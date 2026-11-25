# Install from a local clone

The plugin runs straight from a clone of this repository, so updating is a `git pull`. Setup writes a Cursor workspace that loads the plugin from the clone.

## 1. Prerequisites

- Cursor.
- Node.js 20 or newer, and Git, on your `PATH`.
- GitHub CLI (`gh`), signed in with `gh auth login`. The PR skills (`pr-review`, `pull-request`) and [tooling proposals](../../proposals/README.md) use it.
- A workspace root: a folder that holds the repositories you'll work on and isn't inside a repository itself. [Layouts](README.md#layouts) shows the shape for sibling repositories, a monorepo and a single repository. These steps use `~/src/acme` on macOS and `C:/src/acme` on Windows.

| Tool | Windows | macOS |
|---|---|---|
| Git | `winget install Git.Git` | `xcode-select --install` |
| Node.js | `winget install OpenJS.NodeJS.LTS` | `brew install node` |
| `gh` | `winget install GitHub.cli` | `brew install gh` |

If you install any of these now, fully quit and reopen Cursor so it sees them.

## 2. Clone this repository

Clone it anywhere; it doesn't need to be inside the workspace root.

```bash
# macOS
git clone <repository URL> "$HOME/src/agent-tooling"
```

```powershell
# Windows
git clone <repository URL> "C:/src/agent-tooling"
```

The plugin runs whatever the clone has checked out, including uncommitted edits. Keep the clone on `main`, and review or edit other branches in a separate `git worktree`.

## 3. Run setup

```bash
# macOS
node "$HOME/src/agent-tooling/plugins/agent-tooling/scripts/workspace.mjs" --project-dir "$HOME/src/acme" --plugin-dir "$HOME/src/agent-tooling/plugins/agent-tooling"
```

```powershell
# Windows
node "C:/src/agent-tooling/plugins/agent-tooling/scripts/workspace.mjs" --project-dir "C:/src/acme" --plugin-dir "C:/src/agent-tooling/plugins/agent-tooling"
```

Both paths must be absolute. Setup detects roles and tools, records the clone as `pluginPath`, and writes the workspace. When it fails, it prints an error instead; see [Errors and warnings](README.md#2-errors-and-warnings). Its output shows `"registration": "workspaceOpen"` and a `runtime` with `"status": "ready"`, the resolved `paths`, `tools`, `missingTools` and `warnings`. Check that:

- `paths` has `CLIENT`, `DOTNET` or `TILT` for each role you expect. When a role is missing or `warnings` names several candidates, set `roles` in `agent-tooling.local.json` ([First run and later runs](README.md#first-run-and-later-runs)). `sql` is never detected; add it by hand when the schema has its own folder, such as a SQL project, and leave it unset when the schema lives in EF Core migrations or migration scripts inside the .NET solution's folder ([Workspace model](README.md#workspace-model)).
- `missingTools` lists nothing your work needs. Otherwise see [A tool is missing](README.md#3-a-tool-is-missing).

The workspace file is written only when it doesn't exist. If you change `roles` after this step, delete `agent-tooling.code-workspace` and rerun the command so the workspace opens the right folders.

What setup writes, all under the workspace root:

```text
~/src/acme/.cursor/agent-tooling/     {ARTIFACTS}, shown as the "agent-tooling" folder in the workspace
├── agent-tooling.code-workspace      the workspace to open
├── agent-tooling.local.json          roles, tool paths and pluginPath for this machine
└── .cursor/
    ├── hooks.json                    loads the plugin when the workspace opens; adds the runtime snapshot when a chat starts
    ├── load-plugin.mjs
    └── session-start.mjs
```

Workflows add folders here as they run, such as `planning/`, `code-review/` and `playwright/`.

**None of it belongs in a repository.** The workspace root isn't a repository, so these files stay out of version control as long as you don't copy them into one. `agent-tooling.local.json` holds absolute paths for this machine, so don't share it or put credentials in it. Credentials go in `~/.agent-tooling/credentials` ([Credentials file](USAGE.md#credentials-file)), which you never commit either.

## 4. Open the workspace

1. In Cursor, **File → Open Workspace from File** and pick `<workspace root>/.cursor/agent-tooling/agent-tooling.code-workspace`.
2. Command Palette (**Ctrl+Shift+P** or **Cmd+Shift+P**) → **Developer: Reload Window**.
3. In **Cursor Settings → Plugins**, check that **Agent Tooling** is listed once.

Always open Cursor through this workspace file. The plugin loads only there; opening a repository folder directly gives you no tooling.

## 5. Verify

In a **new** chat, paste:

```text
Reply only with the JSON object after AGENT_TOOLING_RUNTIME in this chat's startup context. Do not call tools, read files, or infer values. If the context is absent, reply MISSING.
```

Check that:

- `status` is `ready`
- `paths.CURSOR` is your clone's `plugins/agent-tooling` folder
- `paths.WORKSPACE` is your workspace root
- `paths` has `CLIENT`, `DOTNET`, `SQL` or `TILT` for each role you configured
- `missingTools` lists nothing you need

For `MISSING`, another status or an unexpected value, see [Troubleshooting](README.md#troubleshooting).

Optional end-to-end check, in a new Agent chat:

```text
Read AGENT_TOOLING_RUNTIME from startup context; stop if it is missing or not ready. Pick one role folder from paths and name one build or test command it defines and the file that defines it. Do not run anything or change any file except the report. Write the findings to {ARTIFACTS}/plugin-verification/local-discovery.md and report its path.
```

## Next steps

Core guidance works now. Some workflows need more: `gh`, Playwright MCP, the credentials file or a local database. See [Requirements](USAGE.md#requirements).

## Updating

1. Run `git pull` in the clone.
2. Rerun the step 3 command. It leaves current files alone. If it reports `Refusing to overwrite existing workspace file: <file>`, that file differs from what setup writes now: delete it and rerun.
3. Reload the window and start a new chat.

If you move the clone, set `pluginPath` in `agent-tooling.local.json` to the new `plugins/agent-tooling` folder, or remove `pluginPath` and rerun the step 3 command with the new paths.
