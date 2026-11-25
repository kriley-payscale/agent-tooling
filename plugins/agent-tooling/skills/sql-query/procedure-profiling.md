# Stored procedure profiling

## Stored procedure CPU baseline

A stored procedure's CPU baseline comes from `sys.dm_exec_procedure_stats` (`total_worker_time / execution_count`), not from summing `sys.dm_exec_query_stats` across its statements. `query_stats` attributes CPU to queries only; DDL executed inside the procedure — notably `CREATE INDEX` on a `#temp` table — is recorded nowhere. Use `query_stats` only to apportion the procedure-level total, and treat the difference as the DDL cost. When that gap is large, enumerate the procedure's `CREATE INDEX` statements before optimizing any query.

```sql
SELECT OBJECT_NAME(ps.object_id) AS proc_name,
       ps.execution_count,
       ps.total_worker_time / ps.execution_count / 1000 AS avg_cpu_ms,
       ps.total_elapsed_time / ps.execution_count / 1000 AS avg_ms
FROM sys.dm_exec_procedure_stats ps
WHERE ps.database_id = DB_ID()
  AND ps.object_id = OBJECT_ID('dbo.YourProc');
```

## Per-statement procedure profiling

`sys.dm_exec_query_stats` has no `object_id` or `database_id` column. Filter a procedure's statements with `CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st`, then `st.objectid = OBJECT_ID('dbo.YourProc') AND st.dbid = DB_ID()`.

Dump plan XML through `sqlcmd` with `-h -1 -y 0 -o <file>` (`<connection>` is the argument set in [SKILL.md](SKILL.md) "Connection details"). Without `-y 0` the XML is silently truncated at the default column width and looks like a valid but short plan.

```bash
sqlcmd <connection> -h -1 -y 0 -o /tmp/plan.xml -Q "SELECT qp.query_plan FROM sys.dm_exec_query_stats qs CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st CROSS APPLY sys.dm_exec_query_plan(qs.plan_handle) qp WHERE st.objectid = OBJECT_ID('dbo.YourProc') AND st.dbid = DB_ID();"
```

## Temp-table indexes

A nonclustered index on a `#temp` table is worth its build cost only if a later statement uses it as an access path. Capture the consuming statement's plan XML and look for the temp table under an index operator.

- If the table appears only as `<Object … Table="[#Foo]">` on a `Table Scan` with no `Index=` attribute, the index is not an access path — join side does not matter.
- An index name appearing solely inside `<StatisticsInfo>` means the optimizer used its statistics and nothing else; that is not usage.
- Build cost tracks sort-key width as much as row count, so a small temp table is not a reason to assume its index is cheap.

## Capturing a procedure result set that takes TVPs

`sys.dm_exec_describe_first_result_set` returns NULL column metadata when the sample call passes NULL for a table-valued parameter, so it cannot derive the `CREATE TABLE #Temp` shape. Declare the TVP as a typed local (`DECLARE @empty dbo.YourTableType;`), hand-write the temp table from the procedure's own final `SELECT` or from `sys.columns` on the underlying base tables, then `INSERT INTO #Temp EXEC dbo.usp_YourProc @Args`. That sink is the prerequisite for timing (`DATEDIFF` around the `INSERT … EXEC`) and for comparing two procedure versions row by row.
