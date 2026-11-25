# pr-review — worktrees

## Create

Create one detached worktree for the PR under review, so no PR branch is checked out or tracked:

```bash
git -C <checkout> fetch <remote> <baseRefName> "pull/<n>/head"
git -C <checkout> worktree add --detach "$TMPDIR/pr-review/<repo-dir>-<n>" <head-sha>
```

`<remote>` is the PR repository's remote from step 1 of [SKILL.md](SKILL.md). `<repo-dir>` is the repository name lowercased, with each run of characters other than `a-z` and `0-9` replaced by one hyphen and the ends trimmed (`My.Api` becomes `my-api`). `<wt>` below is the worktree path, and `<layer path>` is a layer's folder relative to the repository root (`git -C <role folder> rev-parse --show-prefix`).

When the repository has submodules (a `.gitmodules` file), initialize them. A new worktree does not, and the build then fails on whatever the submodule provides, for example `CS0234` on its namespace:

```bash
git -C "<wt>" submodule update --init --recursive
```

Never run `git submodule deinit` in the worktree: submodule registration lives in the repository's shared config, so it unregisters the submodule in the main checkout too.

Scratch commits, such as characterization tests, go only on a throwaway branch inside the worktree. A branch created from the detached head has no upstream:

```bash
git -C "<wt>" switch -c pr-review/scratch-<n>
```

## Per-layer setup

### .NET

Run builds and tests outside the sandbox, from `<wt>/<layer path>`, under `{CURSOR}/rules/dotnet-build-loops.mdc`: build what that rule names, with no pipes, no redirects and no verbosity flags.

```bash
dotnet build <project>.csproj
dotnet test <test-project>.csproj --no-build --filter "FullyQualifiedName~<TestClassName>"
```

Building in the worktree leaves the watched checkout untouched. When a build fails, classify it under rule `dotnet-build-failures`. A failure the PR introduced is a finding; an environmental failure is a limitation.

### Client

Reuse the main checkout's `node_modules` only when its package files match the PR head's. Name the lockfile the repository uses (`package-lock.json`, `yarn.lock` or `pnpm-lock.yaml`). `<deps>` is the folder that holds it and the installed `node_modules`, relative to `{CLIENT}`: `.` when the client has its own, or the relative path up to the repository root (such as `../..`) in a workspaces monorepo with one root lockfile. A `git diff` path that matches no file passes silently, so check that the lockfile exists first:

```bash
test -f "{CLIENT}/<deps>/<lockfile>" && git -C {CLIENT} diff --quiet <head-sha> -- package.json "<deps>/<lockfile>" && ln -s "{CLIENT}/<deps>/node_modules" "<wt>/<layer path>/<deps>/node_modules"
```

On Windows, run this only after both checks above succeed:

```powershell
New-Item -ItemType Junction -Path "$env:TEMP\pr-review\<repo-dir>-<n>\<layer path>\<deps>\node_modules" -Target "{CLIENT}\<deps>\node_modules"
```

If the lockfile is missing or the files differ, do not install. Record "client tests not run: dependencies differ from the main checkout" as a limitation.

When the client uses Nx, run focused specs with the Nx daemon, Nx Cloud, and the local Nx cache off. A cached run replays an earlier result after a scratch spec changes. Otherwise run the one spec file through the repository's test script.

```bash
NX_DAEMON=false NX_NO_CLOUD=true npx nx test <project> --skip-nx-cache --testFile=<repo-relative-spec>
```

Evidence is the named suite and test lines with their pass or fail result. `passWithNoTests` makes a bare success footer meaningless.

### Schema

No build is required. Verification is static (L1) and read-only data checks (L2). Never deploy the schema, and never apply migrations to a database.

## Cleanup

For a client worktree with a linked `node_modules`, first remove the link, never its target, and confirm it is gone:

```bash
rm "<wt>/<layer path>/<deps>/node_modules"
test ! -L "<wt>/<layer path>/<deps>/node_modules"
```

On Windows, use the following instead. `Directory.Delete` without a recursive flag removes only the junction and never touches its target. `Test-Path` must print `False` before `git worktree remove --force` runs.

```powershell
[System.IO.Directory]::Delete("$env:TEMP\pr-review\<repo-dir>-<n>\<layer path>\<deps>\node_modules")
Test-Path -LiteralPath "$env:TEMP\pr-review\<repo-dir>-<n>\<layer path>\<deps>\node_modules"
```

Then, for each worktree:

```bash
git -C <checkout> branch -vv --list 'pr-review/scratch-*'
git -C <checkout> worktree remove --force "<wt>"
git -C <checkout> branch -D pr-review/scratch-<n>
git -C <checkout> worktree prune
```

The `branch -vv` output must show no upstream (`[<remote>/...]` or any other) on any scratch branch before deletion. If one has an upstream, stop and report it. Do not delete the branch and do not push.
