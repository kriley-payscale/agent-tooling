# Handling reports

Pause the affected task and its dependents while resolving a blocker. Preserve partial work. Under the schema rule's fidelity boundary, inspect the report, diff, exact failure, live task, Decisions, applicable guidance, and relevant authoritative sources. The implementation agent first attempts recovery within its `Owns` and permitted checks; the Lead then uses its additional context, Lead-owned verification, and already-authorized prerequisite recovery. A source-backed answer is not permission to make a new product or design choice.

Route by status first: `done` requires `blocker: none`; `blocked` requires a non-none blocker; `failed` follows failure recovery. Contradictory values get one report-repair request, never a new status or silent completion.

- `design-question`: if the fixed Decisions or authoritative sources establish the answer without changing the plan, cite it, log it, and resume the same agent. If a requirement, public/data contract, shared name, or user-visible behavior remains unsettled, use the unresolved-blocker stop procedure.
- `scope`: establish whether the required work is already assigned and sequenced by the plan. Never extend `Owns` or authorize a substitution. If the task cannot finish under its existing ownership and dependencies, use the unresolved-blocker stop procedure; an undisclosed ownership change needs a reviewed plan revision.
- `plan-defect`: inspect references and sources for an answer that satisfies the plan as written. If none exists, use the unresolved-blocker stop procedure. Do not repair the executable plan during Build.
- `environment`: restore a missing prerequisite only within existing authorization and permissions, then resume the same agent after actual resolution. If unavailable or restoration fails, use the unresolved-blocker stop procedure.
- `failed`: read the report and diff. For an attributable implementation failure, resume the same agent once with a targeted correction and exact error, then rerun the exact required verification. If that correction fails, use the unresolved-blocker stop procedure. Do not replace the agent to retry around the limit.

Record the blocker, sources, attempts, results, final disposition, and remaining question in the execution ledger, including successful recovery, and any tooling friction. Resume only after actual resolution, include the supported answer/correction, and require fresh verification evidence. Do not bypass an agent's editing or command restrictions.

Limits:

- One targeted same-agent correction per attributable implementation failure, followed by the exact verification rerun.
- The same cause returning after one answer or attempted resolution stops implementation.
- A third recovery resume of one task stops implementation.
- Investigation is bounded to relevant evidence and existing permissions, not repeated retries or broader redesign.

## Unresolved-blocker stop

Stop new dispatch and further implementation, including independent tasks. Cancel running workers through supported runtime controls and keep their repositories occupied until the stop is confirmed; record uncertain liveness instead of releasing or duplicating a worker. If immediate cancellation is unavailable, dispatch/resume nothing further and disclose any in-flight work that finishes before the stop takes effect. Preserve partial edits, incomplete task state, and accumulated logs. Report per [completion-summary.md](completion-summary.md) before yielding; bookkeeping does not authorize further implementation or premature task completion.

Ask the user one actionable question explaining the blocker, attempted resolutions and results, remaining choice or prerequisite, and recommendation; then wait. Do not re-ask settled scope. A clarification confirming the existing plan permits same-agent resumption; a plan change needs an explicitly reviewed revision before affected work resumes. Do not edit the executable plan during Build.

The stop still permits explicitly planned fixture cleanup/restoration using known created IDs and captured original values. Attempt that cleanup before yielding, including after an unavailable capability or failed check; record any unsafe or unsuccessful cleanup as an unresolved blocker. It does not authorize new fixtures, implementation, broader deletes, or guessed restoration values.
