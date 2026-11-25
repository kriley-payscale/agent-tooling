# Attribute cost from the plan cache

## Read cost per execution

Derive true per-execution read cost from the plan cache after the request under test. This measures the statement as EF actually parameterized and ran it, needs no parameter reconstruction, and yields logical reads and row counts in the same row — so reads-per-row falls out directly.

Do not rebuild an EF-emitted statement's parameters by hand. It is not merely impractical; the result is silently wrong.

- EF logs parameter values as `?` unless sensitive-data logging is enabled, so a hand A/B tempts you to re-derive the list with a separate query, which can resolve a different scope than the request under test.
- A reconstructed arm that is an order of magnitude wider than the real one still shows the right direction, so nothing looks broken, but its magnitude does not transfer and must not be quoted as the expected gain.
- Prefer the plan cache. When the cache is not enough, either enable sensitive-data logging to capture the literal values the request actually bound, or derive the arm from the plan-cache entry for that execution.
- State the captured list size in the A/B writeup so a reviewer can check it against production.
- `SET STATISTICS TIME ON` still requires rebuilding the statement. Under EF Core 10's default collection mode, a `Contains` over hundreds of ids means reproducing one scalar parameter per id; past the fallback point (about 2098 total parameters, measured on 10.0.10), on EF Core 8 or 9, or under `ParameterTranslationMode.Parameter`, it means fabricating the JSON payload `OPENJSON` reads (`{CURSOR}/skills/dotnet-ef-query-optimization/restrictions.md`).

When the cache is not enough and the emitted statement must be re-run — `SET STATISTICS IO` scan counts are the usual reason, since the cache reports logical reads but not per-table scans — run it through `sp_executesql` with the same parameter declarations EF used. Do not substitute `DECLARE @p int = <value>`. A declared local is not sniffable; the optimizer compiles against density guesses and can pick a different plan than the application. A slower `DECLARE` reproduction is not evidence the change failed. A fast `DECLARE` run proves nothing about the parameterized plan.

```sql
;WITH statements AS (
  SELECT qs.execution_count,
         qs.total_elapsed_time / qs.execution_count / 1000 AS avg_ms,
         qs.total_worker_time  / qs.execution_count / 1000 AS avg_cpu_ms,
         qs.total_logical_reads / qs.execution_count       AS avg_reads,
         qs.total_rows / qs.execution_count               AS avg_rows,
         SUBSTRING(
           t.text,
           qs.statement_start_offset / 2 + 1,
           (CASE WHEN qs.statement_end_offset = -1
                 THEN DATALENGTH(t.text)
                 ELSE qs.statement_end_offset END) / 2
             - qs.statement_start_offset / 2
         ) AS statement_text
  FROM sys.dm_exec_query_stats qs
  CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) t
)
SELECT *
FROM statements
WHERE statement_text LIKE '%<a literal from the projection>%'
ORDER BY avg_ms * execution_count DESC;
```

## Attribute one request without changing log levels

Changing log levels can mean a republish and restart of the API. When that cost is not worth paying, attribute a single request from the plan cache instead. Record the start time as `varchar(23)` with style 121 — 7-digit precision fails the `datetime` comparison, and a `varchar(30)` timestamp raises Msg 241:

```sql
SELECT CONVERT(varchar(23), SYSDATETIME(), 121);
```

Make the request, then list the statements that ran after that time. The `last_*` columns describe the most recent execution, so no before/after diff is needed. Order by `last_execution_time` to recover the call sequence.

```sql
DECLARE @t0 varchar(23) = '<captured value>';

;WITH statements AS (
  SELECT qs.last_execution_time,
         qs.last_elapsed_time / 1000 AS last_elapsed_ms,
         qs.last_worker_time  / 1000 AS last_cpu_ms,
         qs.last_logical_reads,
         qs.last_rows,
         SUBSTRING(
           t.text,
           qs.statement_start_offset / 2 + 1,
           (CASE WHEN qs.statement_end_offset = -1
                 THEN DATALENGTH(t.text)
                 ELSE qs.statement_end_offset END) / 2
             - qs.statement_start_offset / 2
         ) AS statement_text
  FROM sys.dm_exec_query_stats qs
  CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) t
  WHERE qs.last_execution_time >= @t0
)
SELECT *
FROM statements
WHERE statement_text LIKE '%<table-name fragment>%'
  AND statement_text NOT LIKE '%sys.dm[_]%'
ORDER BY last_execution_time;
```

Do not filter on `sys.dm_exec_sql_text(...).dbid`. Parameterized EF batches run through `sp_executesql` report a NULL `dbid`, so the filter returns zero rows with no error. Filter on a table-name fragment in the extracted statement text instead, and exclude the instance's background statements (the `sys.dm` exclusion above is the minimum). See `{CURSOR}/skills/sql-query/plan-cache-filtering.md` for the `LIKE` bracket and whole-batch cautions.

Caveats:

- Reliable only when no other traffic hits the same tables in that window.
- Bulk copy statements do not appear.
- A failed batch can masquerade as a zero-row result: `sqlcmd` exits 0 after a SQL error unless it runs with `-b`, which the `<connection>` set in skill `sql-query` includes. Trust an empty list only from a run with `-b` that exited 0.
