# pr-review — schema and data script defect hunts

Hunt format and the verification ladder: [defect-hunts.md](defect-hunts.md) and [SKILL.md](SKILL.md). These hunts cover schema source (object scripts in a SQL project, or EF Core migrations) and data scripts. The review never deploys the schema or applies a migration.

### D1 — Schema file the deployment never picks up
- **Signal:** a new object or script file that the project must list or embed and does not: a SQL project that names files explicitly (`<Build Include="...">` in a `.sqlproj`), scripts a migration runner reads as embedded resources (`<EmbeddedResource>`), or an EF Core migration without its `[Migration]` and `[DbContext]` attributes (normally in the `.Designer.cs` file).
- **Verify:** L1. `git grep -n '<file name>' <sha> -- '*.sqlproj' '*.csproj'`, compared with a sibling file's entry. A project that includes files by glob needs no entry.
- **Rule:** `{CURSOR}/skills/sql-object/SKILL.md`.
- **Example:** the project file entry of a sibling object in the same folder.

### D2 — Destructive change to existing data
- **Signal:** a dropped or renamed column, narrowed type or length, nullable-to-not-null change, or dropped table or constraint, in a script or migration.
- **Verify:** L2 by counting existing rows that the change would truncate or reject, such as `SELECT COUNT(*) FROM dbo.Widget WHERE LEN(Name) > 50`. Never deploy to a database; the review is read-only.
- **Rule:** none canonical; the L2 count is the evidence.
- **Example:** none to cite.

### D3 — Data script that is unsafe to run twice
- **Signal:** an `INSERT`, `UPDATE`, or `DELETE` without an existence or state guard, in a script the tooling can run again (a post-deployment script that runs on every deploy, or a retried script after a partial failure); no transaction around multi-statement changes.
- **Verify:** L1. Read the script twice as if run on an already-deployed database.
- **Rule:** `{CURSOR}/skills/sql-data-script/SKILL.md`.
- **Example:** `IF NOT EXISTS (SELECT 1 FROM dbo.Setting WHERE Name = 'MyFeature') INSERT ...` inside `BEGIN TRY` and `BEGIN TRANSACTION`.

### D4 — Rename the schema tool treats as drop and create
- **Signal:** a column or table renamed without the tool's rename record: in a SQL project, no rename entry in its `.refactorlog`; in EF Core, a migration that drops and adds the column instead of calling `RenameColumn` or `RenameTable`. Deploying it loses the data.
- **Verify:** L1.
- **Rule:** none canonical; the tool's rename record is the evidence.
- **Example:** a `RenameColumn` call in an earlier migration, or a `Rename Refactor` operation in the refactor log.

### D5 — Uniqueness assumed in code with no unique index
- **Signal:** .NET code using `ToDictionary`, `Single`, `FirstOrDefault` as a lookup, or a `1:1` join on a key the table does not constrain.
- **Verify:** L1 for the missing index, L2 for duplicates (see N1).
- **Rule:** `{CURSOR}/skills/dotnet-ef-query-optimization/cardinality.md` (Cardinality protocol).
- **Example:** `CREATE UNIQUE INDEX UX_Widget_TenantId_Code ON dbo.Widget (TenantId, Code)`, or `HasIndex(w => new { w.TenantId, w.Code }).IsUnique()`.

### D6 — Foreign-key delete action disagrees with the ORM's delete behavior
- **Signal:** `ON DELETE CASCADE` (or no action) in the schema that differs from the relationship's `OnDelete(DeleteBehavior...)` or EF Core's default (cascade for a required relationship, client set-null for an optional one), on a write path that deletes or replaces the principal. Also flag a new relationship mapped in a different style from the codebase's existing ones.
- **Verify:** L1 by comparing both sides; L4 for SQL error 547 on the write path.
- **Rule:** `{CURSOR}/rules/dotnet-entity-naming.mdc` (foreign keys), `{CURSOR}/skills/dotnet-data-access/writes.md` (Relational write ordering for FK-sensitive writes).
- **Example:** none to cite; use the rule.

### D7 — Hand edit to generated scripts
- **Signal:** changes to a file the tooling generates, such as a combined deployment script a build step writes, or an EF Core model snapshot or `.Designer.cs` edited by hand instead of regenerated.
- **Verify:** L1. Find the generator (the build step that writes the file, or the tool command) and compare its output with the committed file.
- **Rule:** none canonical; the generator is the evidence.
- **Example:** none to cite.

### D8 — Reporting view exposes rows the application hides
- **Signal:** a new or changed view for reporting or export that reads a table the application filters by state (archived, soft-deleted, private, current, published, draft) without the same filter, or without a column that lets consumers apply it. Views and procedures bypass EF Core global query filters (`HasQueryFilter`).
- **Verify:** L1 by finding the filter the application applies (a repository predicate or a global query filter) at `<integration>` and comparing it with the view. L2 by counting the rows the view returns that the application would hide.
- **Rule:** `{CURSOR}/skills/sql-object/SKILL.md`; cite the application's predicate as evidence of its filter.
- **Example:** a view that joins with `w.IsCurrent = 1 AND w.IsPublished = 1`, matching the repository's filter.
- **Note:** exposure may be intended for the reporting audience. When it is plausible, classify it as a question for the author with the L2 count, not as a finding.
