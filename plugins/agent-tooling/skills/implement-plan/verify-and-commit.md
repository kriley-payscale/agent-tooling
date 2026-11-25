# Verify and commit a task

Handling reports and the unresolved-blocker stop are in [handling-reports.md](handling-reports.md); other section names are in [SKILL.md](SKILL.md).

## Per-task verification

1. Replace `<timestamp>` in each migration Owns path with the value the worker's `dotnet ef migrations add` generated: the one new `*_<Name>.cs` and `.Designer.cs` pair in that folder (rule `plan-task-schema`, Owns). No pair, or more than one, goes to Handling reports. Then diff the task's repositories against its pre-dispatch status, and each non-Git Owns file against its snapshot (new files by existence), including any of this Build's commits since. Other active tasks' owned edits are not this task's violation. Files changed outside the task's `Owns` mean resuming that agent to revert only its own unauthorized edits; investigate unclear ownership using Handling reports, then stop for user clarification if unresolved. Never discard changes present before dispatch.
2. A concurrent writer (another agent session or the user) can edit a task's `Owns` files during Build. If they changed after the report and the change is not the task's, pause verification and record the conflict; preserve snapshots and all existing edits. Attempt bounded resolution without discarding another writer's work or changing the plan. Verify only after the files are stable; an unresolved moving-target conflict follows the unresolved-blocker stop.
3. Read the changed code and check it against `Done when` and the Decisions. For added, changed or removed tests, apply `{CURSOR}/skills/unit-test-guidance/SKILL.md`, then check reuse of fixtures/helpers and that new setup is necessary. Passing tests and plan compliance alone do not establish an appropriate test design. Return unnecessary machinery to its owner through Handling reports; if the frozen plan requires it, use the plan-defect process rather than silently dropping checks.
4. Before the first command for a role, read `{CURSOR}/rules/dotnet-build-loops.mdc` (`{DOTNET}`), `{CURSOR}/rules/client-build-loops.mdc` (`{CLIENT}`) or `{CURSOR}/skills/sql-query/SKILL.md` (database checks; schema builds and deployments use the repository's own tooling as the task's Verification names it). Run the task's Verification commands one at a time under Checks and shared runtimes. Record command, cwd, exit code, result summary and the source state checked in the ledger; save full output only for a failure. Worker reports and self-checks are not evidence.
5. Classify failures with rule `dotnet-build-failures` for `{DOTNET}`, and rule `client-build-loops` or rule `client-nx-builds` for `{CLIENT}`, and apply Handling reports. Preserve the exact failure; environmental or pre-existing failures do not become worker edits.
6. Corrections or external edits invalidate every result that read the changed files and dependents' evidence that relied on them: reopen those tasks and rerun the affected checks. A later diagnostic run never replaces an original baseline.
7. Record new verification or recovery friction under the task's id before marking it verified.

## Task commits

After a task passes verification, the Lead commits it, one commit at a time.

1. Confirm the repository is on the approved feature branch with the base as an
   ancestor, no merge/rebase/cherry-pick in progress, and the task's Owns files
   still match the verified bytes. Other tasks' commits may have advanced HEAD.
   If an Owns file had uncommitted changes before the task started, do not commit
   it without the user's approval to include them.
2. Stage and commit only the task's changed Owns paths, including new and deleted
   files, with each `<timestamp>` replaced as in Per-task verification step 1:

   ```text
   git --literal-pathspecs add -- <paths>
   git --literal-pathspecs commit --only --file <message-file> -- <paths>
   ```

   Never use globs, `add -A`, `commit -a`, amend, reset, stash, push, `--no-verify`
   or identity/signing changes. Leave unrelated staged and dirty files as they are.
3. Follow the repository's message convention from its recent history
   (`git log -n 20 --format=%B`). The subject is the task artifact's H1 with only
   `# ` removed; add a body or trailer only when that history requires one, such as
   a sign-off. Plan, todo and evidence references belong in the execution ledger,
   never the message. If `git log -1 --format=%B` shows a trailer the host added
   that the convention doesn't use (Cursor's Commit Attribution setting adds
   `Co-authored-by: Cursor`), rebuild with
   `git commit-tree <tree> -p <parent> -F <message-file>` and `git update-ref`,
   and tell the user to turn that setting off.
4. Hooks run normally except in that rebuild. If a hook changes files or the commit
   contains paths beyond the task's, re-verify the affected work.
5. Record the SHA. A no-change task records its reason and makes no commit. Non-Git outputs record
   `not-applicable`; never initialize Git or commit them elsewhere. A task spanning
   repositories gets one commit per repository. A later correction gets a new
   commit with the same subject.
