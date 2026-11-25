# pr-review — cross-layer defect hunts

Hunt format and the verification ladder: [defect-hunts.md](defect-hunts.md) and [SKILL.md](SKILL.md). These hunts compare the two sides of a contract between layers: schema and ORM, server and client.

## Contract reference

When both sides of a contract are in this PR's repository, as in a monorepo, compare them at the head SHA; a mismatch on either side is a finding in this review.

A sibling PR in another repository is a contract reference, not a second review target. Fetch its head without creating a worktree, and read only the contract surfaces this PR produces or consumes. Find `<sibling checkout>` and `<sibling remote>` as step 1 of [SKILL.md](SKILL.md) finds `<checkout>` and `<remote>`:

```bash
git -C <sibling checkout> fetch <sibling remote> "pull/<m>/head"
git -C <sibling checkout> show <sibling-head-sha>:<path>
git -C <sibling checkout> grep -n '<symbol>' <sibling-head-sha> -- '<path glob>'
```

- Contract surfaces: controller routes and action signatures, DTOs and view models, client models and API services, enums, permission or policy names and the data that grants them, feature flag keys, error response bodies, and table definitions or migrations.
- Do not build, test, hunt in, or fetch review-bot threads for the sibling. Never report a finding located in its code.
- When the contracts disagree and this PR's side is wrong, it is a finding in this review. When the sibling's side must change, record it in Cross-Layer Contract Checks as `mismatch: change needed in <owner>/<repo>#<m>`, not as a finding.

When the other side lives in another repository and has no sibling PR, check it against that repository's `<integration>` and record that in Review Limitations.

## Hunts

### X1 — Schema versus ORM mapping
- **Signal:** type, nullability, length, precision, or name differs between the table definition (a schema script, or the migration that creates or alters the table) and the entity property with its attributes (`[Column]`, `[MaxLength]`, `[Precision]`) or fluent configuration (`HasColumnName`, `HasMaxLength`, `HasPrecision`, `IsRequired`). With EF Core migrations, also an entity change with no migration.
- **Verify:** L1 by comparing both sides at the reviewed SHAs; with migrations, `dotnet ef migrations has-pending-model-changes` (EF Core 8 and later) in the worktree. L2 with `INFORMATION_SCHEMA.COLUMNS` when the local database already has the change.
- **Rule:** `{CURSOR}/rules/dotnet-entity-naming.mdc`.
- **Example:** none to cite; use the rule.

### X2 — .NET DTO or enum versus client model or enum
- **Signal:** a property renamed, added, removed, or retyped on one side only; enum members or numeric values out of step; an enum serialized as a string on one side and read as a number on the other (`JsonStringEnumConverter`); a required field optional on one side.
- **Verify:** L1 by comparing the DTO and the client type; L4 by GETting the endpoint and diffing the JSON keys against the model.
- **Rule:** `{CURSOR}/rules/client-models.mdc` (wire ownership and nested payload boundaries), `{CURSOR}/rules/dotnet-project-integrity.mdc`.
- **Example:** none to cite; use the rule.

### X3 — Server route versus client endpoint
- **Signal:** a client API service URL or HTTP method that does not match the action's route: the controller's `[Route]` template with its `[controller]` and `[action]` tokens, the `[Http*("...")]` template, or the OData route.
- **Verify:** L1; L4 for a 404 or 405.
- **Rule:** `{CURSOR}/rules/client-data-api-service.mdc` (the service's actual signature, the server routes and the configured base URL).
- **Example:** none to cite; use the rule.

### X4 — Server authorization versus client guard
- **Signal:** a new permission, role or policy the API checks with nothing that grants it (seed data or migration), a grant nothing checks, or a client route guarded on a permission the API never checks (or the reverse, which leaves users on a page whose calls all return 403).
- **Verify:** L1 across the layers; L4 with a user who lacks the permission, through `api-auth`.
- **Rule:** `{CURSOR}/rules/dotnet-controller-conventions.mdc` (Authorization).
- **Example:** `[Authorize(Policy = "Widgets.Edit")]` on the action and a route guard that checks the same permission.

### X5 — Feature flag checked on one side only
- **Signal:** a client flag read or flag guard with no server check, or a server-gated endpoint whose route the client leaves open; a flag key spelled differently on each side.
- **Verify:** L1.
- **Rule:** `{CURSOR}/rules/client-feature-flags.mdc`, `{CURSOR}/skills/client-angular-route/SKILL.md`; creating a flag in the flag provider needs approval (`{CURSOR}/rules/scope-creep-gate.mdc`).
- **Example:** none to cite; use the rule.

### X6 — Server error body the client never surfaces
- **Signal:** a .NET action returning `BadRequest("reason")`, `ValidationProblem`, or `ProblemDetails` (`detail`, `errors`) that the consuming effect replaces with a generic message, or reads from the property of a different body shape.
- **Verify:** L1 by tracing the controller return to the effect's `catchError`; L4 for the real body.
- **Rule:** `{CURSOR}/rules/dotnet-error-handling.mdc`, `{CURSOR}/rules/client-ngrx-effects.mdc` (Failure handling); `{CURSOR}/rules/client-data-api-service.mdc` when response normalization changes.
- **Example:** see C9 in [defect-hunts-client.md](defect-hunts-client.md).

### X7 — New query pattern with no supporting index
- **Signal:** a new or changed .NET query (or SQL procedure) that filters, joins, or orders a large table on a column or column set no index leads with. Typical shapes: a new foreign-key column used as a predicate, a new filter added beside the tenant key, a new `OrderBy` key used with `Skip`/`Take`.
- **Verify:** L1 by reading the table's indexes in the schema source at `<integration>` or the sibling PR's head (`CREATE ... INDEX` in table scripts, or `HasIndex` and `CreateIndex` in the EF model and migrations). L2 with the table's row count and the missing-index or plan evidence from `{CURSOR}/skills/sql-query/perf-diagnostics.md`. A small or bounded table is not this hunt.
- **Rule:** `{CURSOR}/skills/dotnet-ef-query-optimization/read-shape.md` (a missing index goes through `sql-object`), `{CURSOR}/skills/sql-object/SKILL.md`.
- **Example:** `IX_Widget_TenantId_IsDeleted` with `INCLUDE` columns: a tenant-leading index that carries the state filter.
- **Note:** locate the finding at the query in this PR. When a sibling PR owns the schema, the index belongs there instead: record it in Cross-Layer Contract Checks as `mismatch: change needed in <owner>/<repo>#<m>`, not as a finding.
