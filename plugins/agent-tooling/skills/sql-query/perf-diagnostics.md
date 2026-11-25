# SQL performance diagnostics

`<connection>` is the argument set in [SKILL.md](SKILL.md) "Connection details".

## Diagnose API 504s or browser spinners backed by SQL

Before blaming client code or the proxy, check whether the API left long-running SQL requests:

```bash
sqlcmd <connection> -Q "SELECT r.session_id, r.blocking_session_id, r.status, r.command, r.wait_type, r.cpu_time, r.total_elapsed_time, r.logical_reads, s.host_name, s.program_name, SUBSTRING(t.text, 1, 1000) AS sql_text FROM sys.dm_exec_requests r JOIN sys.dm_exec_sessions s ON r.session_id = s.session_id CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t WHERE r.session_id != @@SPID AND r.database_id = DB_ID() ORDER BY r.total_elapsed_time DESC;"
```

Read the signal:

- `blocking_session_id` / `wait_type` populated: investigate blocking first.
- High `cpu_time`, `total_elapsed_time`, and `logical_reads` with no blocker: CPU/read-bound query shape.
- Multiple similar rows from the API's `host_name` or `program_name`: repeated refreshes likely launched duplicate expensive requests.
- `blocking_session_id = 0` is not "uncontended." If `wait_type` is `LOGBUFFER`, `WRITELOG`, or `PREEMPTIVE_OS_FLUSHFILEBUFFERS` while `cpu_time` stays flat and `total_elapsed_time` climbs, inspect other `dm_exec_requests` rows in the same window — especially `program_name` like `SQLAgent - TSQL JobStep` on `COMMIT TRANSACTION`. That is log-flush contention, not lock blocking and not a CPU/read-bound query shape. Do not rewrite the app statement from that sample.
- A `command` of `*(STATMAN)` with `wait_type` `WAIT_ON_SYNC_STATISTICS_REFRESH` does not own a phase unless `wait_time` accounts for that phase. Read `wait_time` first, then the following non-STATMAN command's `cpu_time` and `total_elapsed_time`. Presence of the STATMAN label is not a stats-floor kill.

## SQL-backed API performance triage

Use this skill to gather SQL evidence only. If the fix is EF query shape, grain-boundary staging, pagination, projection width, or access-list normalization, return to skill `dotnet-ef-query-optimization`.

Inspect active request cost first:

- `total_elapsed_time`: how long the SQL request has been running.
- `cpu_time`: CPU-bound query work.
- `logical_reads`: read-heavy query shape or missing/selectively unused index.
- `wait_type` and `blocking_session_id`: blocking/waiting before query-shape tuning.

For index coverage checks, inspect targeted columns instead of listing every index:

```bash
sqlcmd <connection> -Q "SELECT OBJECT_NAME(i.object_id) AS table_name, i.name AS index_name, ic.key_ordinal, c.name AS column_name, ic.is_included_column FROM sys.indexes i JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id WHERE i.object_id = OBJECT_ID('dbo.YourTable') AND c.name IN ('TenantId', 'YourJoinColumn') ORDER BY i.name, ic.key_ordinal, ic.index_column_id;"
```

Use the output to answer narrow questions:

- Is there an index starting with the filter/join columns?
- Are projected columns included, or will SQL need lookups?
- Is the active request blocked, CPU-bound, or read-bound?

Only kill sessions after identifying the SQL text and getting approval for a mutating action:

```sql
KILL <session_id>;
```

When comparing candidate query shapes with hand-written T-SQL, each candidate must materialize the same projection the application reads: `SELECT <projection columns> INTO #shape ...`, then `SELECT COUNT_BIG(*) FROM #shape`.

- A `SELECT COUNT(*) FROM (...)` wrapper lets the optimizer drop every column the count does not need. Lookups into wide tables disappear, and a covering narrow index can replace the clustered access. Logical reads and CPU then describe a cheaper query than the one that runs.
- Row counts from a count wrapper stay valid; reads, CPU, and plan shape do not.
- Before trusting a shape comparison, sanity-check the baseline arm's reads against the plan cache or a known figure for the application's real statement.

When the application chooses the projected column at run time (a value column that varies by request), run the comparison with a column that no index includes, and say which column it was. A covered column lets a shape use a narrow covering index and report a fraction of the reads, which does not hold for the uncovered columns that make up most requests.

Treat a hand-run comparison that gates a code change as provisional until it is confirmed against the plan-cache row of the statement the application actually emitted.

- A hand-run, even one that materializes the projection, can compile to a serial plan that reads far fewer pages than the application's parallel or adaptive-join plan under its own sniffed parameter.
- Compare logical reads and CPU/elapsed on that cache row, from the same session, before keeping the change. Reads can fall sharply while CPU and elapsed barely move, so decide whether a gate on reads alone is sufficient.
- Make this confirmation the first step after the code change, before equality proof and timing work. Finding the row: [plan-cache-filtering.md](plan-cache-filtering.md). Dumping plan XML through `sqlcmd`, and profiling a statement inside a stored procedure: [procedure-profiling.md](procedure-profiling.md).
