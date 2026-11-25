# Completion summary

After the event loop completes or an unresolved-blocker stop, report:

- task, gate and worker state, final end-to-end results, completed tasks, and pending or blocked work
- blocker recovery attempts, results, disposition, and remaining questions
- decisions made during Build, split into Lead decisions and user decisions
- any detected departure from the plan and its resolution; never present an unauthorized deviation as accepted
- concurrent writers, if any — which tasks deferred verification and which files kept changing
- verification commands and results
- task commits per repository, no-change/non-Git dispositions, and per-UF final outcomes with evidence references
- anything found that is outside the plan's scope
- tooling friction from every report and the Lead's own, with its source

After every task including final verification passes, mark Build complete in the ledger. On an unresolved-blocker stop, keep incomplete task state in the ledger for resumption.
