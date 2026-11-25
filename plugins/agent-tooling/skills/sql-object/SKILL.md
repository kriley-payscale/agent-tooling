---
name: sql-object
description: Use when creating, porting or explicitly changing a table, view, stored procedure or function in the repo's schema source (a SQL project, EF Core migrations, or DbUp or Flyway scripts). Covers finding how the schema is managed, file naming and registration, keys and indexes; not choosing a query optimization.
disable-model-invocation: true
---

# Create, Port or Explicitly Change a SQL Object

## Guidance map

| When | Read |
|---|---|
| A new procedure or table-valued function is proposed for a slow repository read | skill `dotnet-ef-query-optimization`, `{CURSOR}/skills/dotnet-ef-query-optimization/cardinality.md` |
| An index is proposed for query performance, or the local schema or data needs checking | skill `sql-query` |
| The change also moves, renames or backfills existing data | skill `sql-data-script` |
| The schema is managed by EF Core migrations | rule `dotnet-entity-naming` |

## Before you start

- **A new procedure or table-valued function is proposed for a slow repository read:** first apply grain-boundary staging and usually measure it. A procedure is the path only after that shape misses the measured gate and the user signs off, as "Stored procedures and TVFs" in skill `dotnet-ef-query-optimization` requires, or when the user asks for the object. Tables, columns and user-requested object edits carry no such gate.
- **New feature behavior:** default to a new narrowly scoped object. Do not change an existing procedure, view or function unless the user explicitly asks for that exact object to change. If an existing object looks close but is broad, shared or reused by other flows, pause and recommend a feature-specific object instead of editing the shared one.
- **An explicitly requested edit to an existing object, or a new table or column:** edit directly. Read the object and its callers, keep its file and registration, and apply only the relevant steps below. Do not create a replacement or a duplicate registration. The review in Step 4 still applies.

## Step 1 — Find how the schema is managed

Search `{SQL}` when that role is configured, otherwise `{DOTNET}`:

```bash
rg --files "{SQL}" -g '*.sqlproj' -g '*ModelSnapshot.cs' -g 'flyway.*' -g 'V*__*.sql'
rg -l 'DeployChanges\.To|using FluentMigrator|MSBuild\.Sdk\.SqlProj' "{SQL}" -g '*.cs' -g '*.csproj'
```

| Found | Objects live in | A new file is registered by |
|---|---|---|
| `*.sqlproj`, or a `.csproj` on `MSBuild.Sdk.SqlProj` (SQL project) | One file per object, in the project's folders | Nothing in an SDK-style project, which builds every `.sql` file under it unless the project excludes it. A project with `<Build Include>` items builds only the files it lists: add one beside its siblings, or the file is silently left out |
| `*ModelSnapshot.cs` (EF Core migrations) | Entity classes and their configuration, per rule `dotnet-entity-naming`; views, procedures and functions in `migrationBuilder.Sql(...)` calls, as earlier migrations do | `dotnet ef migrations add <Name>`, which writes the migration, its designer file and the updated snapshot; commit all three |
| `DeployChanges.To` (DbUp) | Script files, each run once, in name order | The `.csproj`: scripts are usually embedded resources, and a file the project doesn't embed never runs, with no error |
| `using FluentMigrator` (FluentMigrator) | C# classes with `[Migration(<version>)]`, each run once in version order | The class, in an assembly the runner scans, with a version above every existing migration's |
| `flyway.*`, `V<n>__*.sql` (Flyway) | Versioned `V<version>__<desc>.sql` and repeatable `R__<desc>.sql` scripts | The file name: its version must be higher than every applied one |
| None of these | Plain scripts | Whatever README, manifest or runner list orders the existing scripts |

Follow the mechanism that holds sibling objects of the same kind; if more than one could own the object, ask. Never edit a migration or versioned script that has run anywhere shared; add a new one. Flyway fails validation on the changed checksum, and DbUp and EF Core skip a script or migration they have already recorded as applied.

## Step 2 — Read a sibling SQL file

Read a sibling of the same object type and match it: schema, folder and file naming, bracket quoting, indentation, key column naming (`WidgetId` or `Id`), constraint and index name patterns, date and string types, and any `WITH` options on keys and indexes. Use the schema that siblings in the same area use. Naming comes from the siblings, not from the templates below.

## Step 3 — Create the SQL file

When the mechanism keeps one object per file, the file name matches the object in its `CREATE` statement, schema-qualified (`dbo.Widget.sql` for `[dbo].[Widget]`) unless siblings put the schema in a folder instead. Migrations and versioned scripts follow their tool's naming.

**Table:**

```sql
CREATE TABLE [dbo].[Widget]
(
    [WidgetId]  INT IDENTITY(1,1) NOT NULL,
    [TenantId]  INT               NOT NULL,
    [Name]      NVARCHAR(255)     NOT NULL,

    CONSTRAINT [PK_Widget] PRIMARY KEY CLUSTERED ([WidgetId]),
    CONSTRAINT [FK_Widget_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenant] ([TenantId])
);

CREATE NONCLUSTERED INDEX [IX_Widget_TenantId] ON [dbo].[Widget] ([TenantId]);
```

Do not put `GO` inside a `CREATE TABLE` body. Add audit columns (created and edited date and user) only when sibling tables have them, with the sibling's names, types, nullability and defaults. If the application stamps them (search for a `SaveChanges` override or a `SaveChangesInterceptor`), use exactly the columns it writes.

**Stored procedure:**

```sql
CREATE PROCEDURE [dbo].[usp_GetWidgets]
    @TenantId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT w.[WidgetId], w.[Name]
    FROM [dbo].[Widget] w
    WHERE w.[TenantId] = @TenantId;
END;
```

**Keys and indexes:**

- Always schema-qualify cross-schema references.
- Constraint names are objects in their schema, so they must be unique across it; include the table name, in the siblings' pattern.
- Before adding a foreign key, confirm the referenced table exists in the schema source.
- Every rowstore table gets a primary key in the siblings' style. Key a 1:1 extension or settings table the way sibling 1:1 tables are keyed; with no precedent, give it its own key and enforce 1:1 with a unique nonclustered index on the parent's foreign-key column, which a child foreign key may reference. Columnstore tables are outside this template.
- Every foreign-key column needs an index in which it is the leading key. A composite index covers only the foreign key in its first column. A filtered unique index on a nullable foreign key counts as coverage.
- An index proposed for query performance needs plan or logical-read evidence from skill `sql-query` first; foreign-key coverage is the only index justification that does not.

## Step 4 — Register, build and review

1. Register the file as the Step 1 table says.
2. Build with the repo's own command, from its README, CI workflow or build script. In a SQL project, `SQL71501` (unresolved reference) means the referenced object's file is missing from the project or not registered.
3. Before applying the change to any database, read the SQL it will run (the generated deployment script, or `dotnet ef migrations script <previous> <new>` for EF Core). Look for dropped columns or tables, a table rebuild, a narrowed type, and a rename done as drop and add, which loses the data. A rename needs the tool's rename record (`RenameColumn` or `RenameTable` in EF Core, a `.refactorlog` entry in a SQL project) or an `sp_rename` script that runs first.
4. Apply it only to a local database. Applying anywhere else needs the user.
