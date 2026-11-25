# Build setup

Run these steps in order. Handling reports and the unresolved-blocker stop are in [handling-reports.md](handling-reports.md); other section names are in [SKILL.md](SKILL.md).

1. Open the plan file and resolve its plan slug from Planning artifacts immediately, falling back to the filename stem when no slug is recorded. Set the current checkpoint to `build-entry` before opening task references or validating the plan. Initialize/recover the execution ledger and Build decisions log now, so an entry failure retains its evidence. Then read Decisions, Escalation boundary, todos and task references; open referenced task files/headings and relevant Discovery context. Do not start fresh logs or trust a stale copied task on resume.
2. Validate the plan against the schema rule's Task schema and Plan fidelity sections. A plan in an unsupported format stops Build with a request to re-plan it. Check:
   - task ids, links, discovery headings, Agent and all eleven fields;
   - exclusive Owns: no two tasks own the same path or a parent/child of it;
   - the union of `Depends on` and `Completion depends on` edges: no unknown ids, self-edges or cycles;
   - settled Contracts, frozen user flows with full task and final coverage;
   - task-commit approval in Decisions and each task's repositories in Resources;
   - a final Agent: orchestrator task with Owns: none that depends on every other task.

   orchestrator is never dispatched; generalPurpose workers need no agent file. Defects follow Handling reports without changing the approved artifacts.
3. Check each repository's branch and HEAD against the researched refs in Decisions, and run `git status` and `git diff <researched HEAD> -- <paths>` on undispatched Owns files; confirm intended new files remain absent (for a migration path with `<timestamp>`, no `*_<Name>.cs` in its folder). This Build's own task commits are expected advancement, not drift; include their committed deltas when comparing a task's files. On resume, assess completed/in-progress files against task progress and verified evidence instead. Recheck undispatched files before dispatching them. A difference blocks dispatch: preserve the other writer's work, find out what changed (ask the user when the cause is unclear), and reconcile it with the approved assumptions. An unresolved ownership or source conflict follows the unresolved-blocker stop.
4. Read the shared contract `{CURSOR}/skills/implement-plan/implementation-contract.md` and selected domain worker files. Check required paths and task guidance against Owns and permitted checks. Missing required guidance follows bounded recovery and the unresolved-blocker stop; never silently substitute a domain worker.
   Before any worker starts, verify each implementation repository is on the approved feature branch from Decisions, with the approved base SHA as an ancestor and the expected HEAD; reject the integration branch, a guessed branch, or the right SHA on the wrong branch. Only the Lead performs explicitly approved deferred branch creation, before any worker starts, under Workspace Git readiness step 3; confirm source and index are unchanged afterwards. Unresolved setup blocks dispatch. Build never fetches, switches branches automatically or refreshes the researched base. Non-Git outputs have no branch setup.
5. Before the first dispatch, record any entry friction under `build-entry`, as the Tooling friction section of [SKILL.md](SKILL.md) describes. A validation, baseline, or prerequisite failure before task selection uses `build-entry` under Handling reports and the unresolved-blocker stop. Recovering a prerequisite does not discard the observed friction. Keep saved plans unchanged.

## Resume

On resume, reconcile the ledger with actual agent liveness, partial edits, Git
history and evidence before dispatching. A ledger alone cannot prove a worker
stopped: reattach to or await a live worker rather than duplicate it; unknown
liveness keeps its repository occupied. Invalidate evidence whose source changed; do not rerun
unchanged verified work. If a commit may have succeeded before the ledger recorded
it, search `git log` for a commit with the task's subject whose changed paths and
blobs match the verified bytes before committing again. Never check
out or reset files to make the ledger fit.
