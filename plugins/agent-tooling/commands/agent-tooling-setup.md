---
name: agent-tooling-setup
description: Configure the agent-tooling workspace by detecting repository roles, recording local tool paths and creating the multi-root workspace file, without copying tooling or changing credentials.
---

# Set up the agent-tooling workspace

Use the installed plugin root from `AGENT_TOOLING_RUNTIME.paths.CURSOR`. If startup context is unavailable, derive the plugin root from this command file's absolute location supplied by Cursor.

The workspace root is the folder that holds the repositories: the parent of a single repository or a monorepo, or the folder that holds several sibling repositories. It is never a repository or a folder inside one; setup refuses those. Take it from the engineer's request, or from the open workspace roots when one folder is the common parent of all of them. Otherwise ask for its absolute path. An explicitly supplied path is sufficient; do not ask again.

Run from a terminal with the developer's tools on PATH:

```text
node "<installed plugin root>/scripts/runtime.mjs" setup --project-dir "<absolute workspace root>"
node "<installed plugin root>/scripts/workspace.mjs" --project-dir "<absolute workspace root>"
```

- The first setup writes `<workspace root>/.cursor/agent-tooling/agent-tooling.local.json`, with the roles it detects from markers up to three folders deep, following symlinked folders:
  - `client`: `angular.json`, or `nx.json` in a folder whose `package.json` depends on `@angular/core`
  - `dotnet`: a `.sln` or `.slnx` file, or a `.csproj` when no folder has a solution
  - `tilt`: a `Tiltfile`
  - `sql` is never detected. Set `roles.sql` to the folder of a database schema source kept apart from the .NET code, such as a SQL project. Leave it unset when the schema lives in EF Core migrations or migration scripts inside the .NET solution's folder; that code belongs to `dotnet`.
- A role with several candidates at the same depth is left unset, and `warnings` names the candidates.
- After the first run, `roles` belongs to the engineer. Every rerun detects again but never changes `roles`: it repeats the ambiguity warning for each unset role and does not report a role that has since become detectable. Each role value is a folder relative to the workspace root; several roles may point into the same repository.
- Setup refreshes only the tool paths it detected itself, listed in `discoveredPaths`, and keeps the old detected path for a later retry when it finds no replacement. Manual overrides and paths with no `discoveredPaths` entry are preserved even when inaccessible. To pin a path, edit it away from its detected value or remove its `discoveredPaths` entry. To request discovery of a path, set its configured entry to null and rerun setup.
- The workspace bootstrap creates `<workspace root>/.cursor/agent-tooling/agent-tooling.code-workspace`. It opens the tooling folder and each role's repository once, and keeps an existing workspace file, including one the engineer has edited; delete the file to regenerate it after changing roles.
- Neither command writes inside a repository, copies tooling, updates extensions, installs tools, or reads credentials.

Report the config path, the configured roles and the generated workspace path.

- A `ready` runtime means the workspace is configured, not that every tool, role or workflow is available. Do not claim builds or database connectivity were verified by setup.
- When `missingTools` is nonempty, say **Workspace configured with unavailable tools** and use the runtime `warnings` to explain each blocked operation and its remedy. Report role warnings the same way. Explain that unrelated work can continue.
- Say **not found or inaccessible**, not **not installed**: a tool can exist outside the searched locations or be hidden by the agent's PATH or sandbox.

For a first install, follow the plugin's `INSTALL-LOCAL.md`, which registers the plugin with `--plugin-dir`. Start a new chat after configuration changes. Ordinary work writes artifacts under `<workspace root>/.cursor/agent-tooling`; preserve its workspace file, local configuration and `.cursor/` registration files.
