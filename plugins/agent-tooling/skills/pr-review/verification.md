# pr-review — verification levels

The ladder and the severity cap are in [SKILL.md](SKILL.md).

## L1 pattern

- Search for examples on `<integration>` with `git grep`, not on feature branches.
- An example must comply with the current rule. The most common pattern is not automatically the right one; when the codebase majority and the rule disagree, the rule wins.
- Exclude legacy shapes the rules have replaced, such as EF6 code beside EF Core, `@Effect()` decorators or constructor injection in effects, public `IQueryable` from repositories, and NgModule components where the rules require standalone.
- Cite examples as `path` + symbol and re-check them at `<integration>`.
- The governing rule is the canonical rule or skill a hunt names. Never cite a routing or hunt file as the governing rule.
- If no compliant example exists, cite the rule alone and say so. Never invent a pattern (`{CURSOR}/rules/read-before-write.mdc`).
- When no canonical rule states the expected behavior, write `none canonical` and take the expected behavior from the code itself: the inputs the operation reads, the state it must end in, or a sibling path that handles the same case.

## L2 data

Connect to the local database as `{CURSOR}/skills/sql-query/SKILL.md` describes.

- Run `SELECT` statements only. No `INSERT`, `UPDATE`, `DELETE`, `MERGE`, DDL, `EXEC` of procedures, or temp tables.
- Run uniqueness proofs over the widest population the code path serves, not just one tenant, and state the population next to the counts.
- Then test reachability: restrict to the rows the code path's own filters admit.
- Use `!=` instead of `<>` with the Go-based `sqlcmd`.

## L3 test

Build and test under `{CURSOR}/rules/dotnet-build-loops.mdc` for .NET and `{CURSOR}/rules/client-build-loops.mdc` for the client, with the commands in [worktrees.md](worktrees.md).

- A characterization test must fail at the head SHA for the defect's reason.
- Scratch tests stay on `pr-review/scratch-<n>`. Report the test body and the run output; do not leave the test as a suggested commit.

## L4 runtime

Runtime checks need the app running at the PR head, however the workspace runs it (Tilt, `dotnet run`, `nx serve`). They are available only when the checkout it serves is at the head SHA and has no uncommitted changes in the files under review:

```bash
git -C <served checkout> rev-parse HEAD
git -C <served checkout> status --porcelain -- <changed files>
```

If HEAD differs or the files are dirty, record "runtime verification unavailable" for that layer.

### API call

Use `{CURSOR}/skills/api-auth/SKILL.md`, and for performance claims `{CURSOR}/skills/dotnet-endpoint-profiling/SKILL.md`.

Calls are read-only: `GET`, or a `POST` that only reads. A call that creates, updates, or deletes data writes to the local database through the API; ask the user before making one.

### Browser pass

Run it when the PR changes client layout: sizing, flex or grid rules, overflow, breakpoints, a restructured template, or the inputs that size a chart, grid or resizable panel. Also use it to settle any candidate about rendered behavior that code and specs cannot.

- Use the `playwright` MCP server. Sign in by passing credential key names, never values; `api-auth` says which credential pair fits the user the check needs.
- Confirm the served bundle is the PR head's build (rule `client-nx-builds`) before trusting what renders.
- Open each changed view at 1280 and 1440 wide. Look for clipping, overlap, colliding labels, unreachable controls, and resize or drag handles that do not track the pointer. Check everything that assumed the old size, not just the element the PR changed.
- Stay read-only: navigate, resize, scroll, hover, open and close panels. Do not trigger a save. When opening a view writes by itself, ask the user first.
- Evidence is the route, the viewport width and the measured result (element sizes or positions read from the page). A screenshot alone does not prove a claim.

When the pass is due but runtime is unavailable or the server is missing, list the changed views under Review Limitations as "browser pass not run".
