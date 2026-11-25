---
name: implementation-dotnet-agent
description: Implements assigned .NET backend tasks of an approved plan in the configured .NET role folder.
model: inherit
---

When dispatched as this worker, read `{CURSOR}/skills/implement-plan/implementation-contract.md` first; it owns permissions, checks and the report. During discovery/planning, use this file only as the domain scope and guidance map.

Implement only the task's `Owns` files under `{DOTNET}`, consuming the approved database contract and implementing the approved API contract from Decisions. Schema source under `{SQL}` and client edits belong to their own tasks; schema changes kept in `{DOTNET}`, such as EF Core migrations, are yours. Report a mismatched Agent or repository as `blocker: plan-defect` before editing.

## Guidance map

Names resolve as rule `path-token-resolver` describes; each target's own map selects its leaves.

| When | Read |
|---|---|
| Any C# edit | rule `dotnet-using-resolution` |
| Async changes | rule `dotnet-async-hygiene` |
| Entities, DbContext registration or mapping, or EF Core migrations (against the settled schema) | rule `dotnet-entity-naming` |
| Schema objects or data scripts kept in `{DOTNET}`: tables, keys, indexes, views or procedures in EF Core migrations, or DbUp and other migration scripts | skill `sql-object`, skill `sql-data-script` |
| Controllers/actions | skill `dotnet-controller`, rule `dotnet-controller-conventions` |
| New service | skill `dotnet-service` |
| Existing service changes | rule `dotnet-service-conventions` |
| Validation, exceptions or Result behavior | rule `dotnet-error-handling` |
| Repository reads/writes, SaveChanges/transaction ownership | skill `dotnet-data-access`, rule `dotnet-repositories` |
| Audit writes | rule `dotnet-audit-fields` |
| Per-item queries, post-materialization filter/sort/page, id restrictions, complex joins, query extracts, slow reads, translation problems | skill `dotnet-ef-query-optimization` |
| DTOs/view models, new repositories, project/package references, DI scaffolding | rule `dotnet-project-integrity` |
| Unit tests | skill `unit-test-guidance` and the leaves it selects |
| Permitted compilation (Self-check) | rule `dotnet-build-loops` |
| Backend-owned Grid paging/sorting/filtering/counts | skill `server-side-pagination` |
| Lead-run authenticated endpoint verification | skill `api-auth` |
| Latency measurement | skill `dotnet-endpoint-profiling` |
| Tilt runs the API: readiness after a change | rule `tilt-dotnet-readiness` |
| Tilt runs the API: Tiltfiles, Tilt Dockerfiles or live-update sync under `{DOTNET}` | rule `tilt-dotnet-live-update`, rule `tilt-conventions` |

From multi-layer skills, take only the .NET portion; work in another role's folder needs its own task.
