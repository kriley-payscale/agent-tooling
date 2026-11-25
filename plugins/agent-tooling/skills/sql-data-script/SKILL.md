---
name: sql-data-script
description: Use when adding or changing a rerunnable SQL data script, such as a data fix, backfill, rename, seed or lookup rows, or a pre- or post-deployment script. Not for table, view or procedure shape (sql-object).
disable-model-invocation: true
---

# Rerunnable SQL Data Scripts

If the repo documents its own rules for data scripts (a README beside them, a contributing guide or review instructions), those decide what blocks a PR. This skill covers where a script goes and how to write it.

## Guidance map

| When | Read |
|---|---|
| The script also needs a table, column or object definition change | skill `sql-object` |
| Running the script against the local database | skill `sql-query` |

## Pick the folder

Put the script where the repo keeps data or migration scripts, and follow the most recent ones. In the repo that holds the schema, this lists recently added SQL files:

```bash
git log --diff-filter=A --name-only --format= -- '*.sql' | head -20
```

Read how the deploy runs them: its pipeline, runner script or README. Some pipelines concatenate a folder's scripts in file-name order and rerun them on every deploy; others record each script once it has run. Either way, write the script to be rerunnable, and add no include directive or project entry the existing scripts don't have. With a migration tool, a data change is a new migration in that tool's form, written as below.

- **Before and after the schema change.** When the repo separates them, "before" scripts run before this change's new tables and columns exist, so anything that needs them goes after. Use "before" only for `sp_rename`, moving data out of a column or table about to be dropped, deduplicating ahead of a new unique constraint, or a guarded online index or column add that the schema deploy would otherwise do offline.
- **Scripts run by hand.** A folder for them is for steps the user or ticket calls manual, such as per-environment values or a long bulk change.
- **Shipped scripts.** Never edit or move a script that has run in a shared environment; write a new one.
- **Generated output.** Never hand-edit a file a build step writes, such as one that combines the scripts; edit the source script.

## Name

Follow the siblings' naming. When names carry a date and a ticket key, order several scripts for one change with a number after the key (`_1_`, `_2_`). When the runner orders by file name, scripts from different changes interleave by name: if another pending script touches the same tables, agree the order with its author or combine them.

## Structure

A second run must be a no-op and must not touch rows already in the target state.

```sql
SET NOCOUNT ON;

IF OBJECT_ID(N'<BackupTable>', N'U') IS NULL
    SELECT TOP 0 * INTO <BackupTable> FROM [dbo].[Widget]
    UNION ALL SELECT TOP 0 * FROM [dbo].[Widget];

IF EXISTS (SELECT 1 FROM [dbo].[Widget] WHERE <rows not yet fixed>)
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        UPDATE w
        SET w.[Status] = <value>
        OUTPUT DELETED.* INTO <BackupTable>
        FROM [dbo].[Widget] w
        WHERE <rows not yet fixed>;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO

/* Rollback
UPDATE w SET w.[Status] = b.[Status]
FROM [dbo].[Widget] w
JOIN <BackupTable> b ON b.[WidgetId] = w.[WidgetId];
*/
```

- Put the backup where the repo's existing scripts put theirs (search them for `OUTPUT DELETED`), named for this script. With no precedent, ask where backups belong.
- `SELECT ... INTO` copies the source's `IDENTITY` property, and `OUTPUT DELETED.* INTO` cannot write explicit values into an identity column. The `UNION ALL` makes `SELECT ... INTO` create the backup column without `IDENTITY`.
- Use `OUTPUT DELETED.*` for `UPDATE` and `DELETE`, and `OUTPUT INSERTED.*` when inserting into live tables.
- If the table has audit columns, set them the way sibling scripts do.
- Seed rows use `IF NOT EXISTS` or `WHERE NOT EXISTS`, with keys resolved by name or another natural key. Never hard-code identity values; they differ by environment.
- A script with only existence-guarded DDL needs no transaction or backup.

## Helper procedures

Call the repo's helper procedures where sibling scripts do, such as for settings or lookup rows, behind an existence guard. Read the helper first: SQL Server silently truncates a string longer than a `VARCHAR(n)` parameter, and a helper that rolls back its own transaction rolls back the caller's too.

## Predictable mistakes

- **No trailing `GO`.** When the deploy concatenates scripts or pulls them in with `:r`, the next file joins the batch, and a duplicate `DECLARE` fails the whole deploy.
- **A column the batch can't see yet.** A batch compiles before any of it runs. A reference to a column that doesn't exist at that moment fails with Msg 207 (invalid column name), even inside an `IF` that would skip it: a column added earlier in the same batch, or one a rerun finds already dropped. Run that statement through `EXEC sp_executesql N'...'`, or put it in a later batch.
- **DDL that lives only in a script.** When object files declare the schema, they are the source of truth, and the next schema deploy undoes what they don't contain. A column added by a "before" script must match the object file's column position and constraint names, or the deploy rebuilds the table.
- **A rename as add, copy, drop.** Use `sp_rename` in a script that runs before the schema change, and update the object definition.
- **Unqualified names.** Always schema-qualify: `dbo.Widget`.
- **Large tables.** One statement over a large or busy table holds its locks for the whole deploy. Above about 10k rows, loop `UPDATE TOP (@BatchSize) ... WHERE <rows not yet fixed>` until `@@ROWCOUNT = 0`, committing each batch, or ask whether it should be a manual step.

## Verify

Run the script twice against the local database with `sqlcmd <connection> -i <script>` (skill `sql-query`), whose `-b` makes a failed batch exit non-zero. The second run must change nothing and raise no errors. A deploy alone doesn't prove the script can rerun: a runner that records completed scripts, as DbUp and Flyway do, skips them the next time.
