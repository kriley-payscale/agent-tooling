# Triage and translation checks

Scope: EF Core on SQL Server.

## Verify EF translation, not only LINQ behavior

Mocked `IQueryable` tests and EF InMemory fixtures prove the C# expression behaves against in-memory data. They do not prove that EF can translate the expression into valid SQL.

Do not rewrite a suspicious LINQ expression (for example `Convert.ToDecimal` on `double?`) during a readability extract or private-query collapse. Pin it. Changing it is a SQL-shape change and needs provider evidence.

When moving responsibilities or reassembling a query (shared private `IQueryable`, collapsed duplicate joins, batched per-row loaders), add characterization coverage **before** the extract: the trigger is in `{CURSOR}/skills/unit-test-guidance/dotnet-conventions.md` ("Characterization tests") and the fixture design in `{CURSOR}/skills/unit-test-guidance/dotnet-characterization.md`. InMemory characterization is semantic evidence only.

Nested aggregates or aggregate projections containing correlated subqueries can compile and pass mocked tests, then fail against SQL Server with error 130: `Cannot perform an aggregate function on an expression containing an aggregate or a subquery.`

A keyless entity (a mapped TVF or view result) projected through `.DefaultIfEmpty()` can be compared to null only as the entire conditional test: `x != null ? x.Prop : null`.

- Combining that comparison with `&&` or `||` throws `Cannot translate the '!=' on an expression of entity type ... keyless entity` at query time on SQL Server. Unit tests pass, and EF InMemory cannot show it because it cannot run the function.
- Either keep the null check as the sole test, or read the nullable property directly through the `OUTER APPLY`, where a missing row yields NULL.
- Run the changed query shape on SQL Server before reporting such a change done.

Choosing the latest row per key with `GroupBy(key).Select(g => g.OrderByDescending(...).First())`, as the join source of a larger composed query, has failed translation on the EF InMemory provider. It throws `InvalidOperationException` ("could not be translated") at query time, not compile time. Do not plan it as a fallback until both the InMemory test paths and SQL Server have executed it. The translatable alternative is `MAX(date)` per key joined back on the key.

For changed complex query shapes:

1. Keep focused unit tests for semantics.
2. Add provider-backed integration evidence or call the live authenticated endpoint to prove translation and execution.
3. Inspect the generated/runtime SQL error before treating a service-level pass as sufficient.

When a repository method combines provider-only SQL or TVF execution with deterministic post-materialization composition, keep those responsibilities separate. Unit-test the pure composition through a stable test seam; do not add an InMemory-specific production branch or use reflection as the default way to test private implementation details. Treat the composition test as semantic evidence only. If the provider query, predicates, joins, projection, or mapped-function call changes, also require SQL Server-provider-backed integration or live-endpoint evidence.

When SQL cannot translate a combined aggregate, materialize only narrow, filtered, bounded rows, then compute the final counts in memory:

```csharp
var rows = await filteredQuery
    .Select(x => new { x.Id, IsDirty = x.ModifiedAt > cutoff })
    .ToListAsync();

result.TargetCount = rows.Count;
result.DirtyTargetCount = rows.Count(x => x.IsDirty);
```

Do not use this as permission for broad early materialization. Filters, joins that reduce cardinality, and narrow projection still belong in SQL.

## Troubleshooting slow EF LINQ

Before proposing any fix, including an index, open skill `sql-query` and get the plan and logical reads for the statement. If the query cannot be run or located, ask for the plan or logical-read numbers instead of guessing. An index change goes through skill `sql-object`, whichever mechanism owns the schema.

1. Reproduce through skill `api-auth` when endpoint auth matters.
2. Capture repository stage timings and row counts.
3. Use skill `sql-query` DMVs for active request elapsed time, CPU, logical reads, wait type, and blocking.

   **A cardinality misestimate is only a cost if a corrected estimate would produce a different plan. Prove that before designing a fix around it.** Run the same query with the suspect predicate in its alternative shapes and compare **logical reads**, not elapsed time. If reads are flat across shapes, the estimate is not the cost and the plan is already the plan the optimizer would pick with perfect information — stop, and look at row grain instead.

   Single-factor variants can stay flat when two shape changes are jointly necessary. A `Contains` over ids SQL can already derive, plus a flattenable `DISTINCT … WHERE` subquery, is that pair: dropping either one leaves the nested-loops plan. Measure the combination before treating the estimate as harmless. The three-shape restriction test (keep the list as it is emitted / drop the predicate / inline literals; how the context emits a captured list is in `restrictions.md`) is still the test for whether the restriction itself is the cost.

   Row grain is the other candidate, and it has its own signature: divide logical reads by rows returned. Hundreds of reads per returned row means the same source rows are being re-read once per row of a coarser grain — a fan-out that the outer `GROUP BY` collapses back down. Confirm by counting the pre-aggregation intermediate row count against the final row count. The fix is to aggregate each `1:N` input to its own grain *before* joining, not to improve the estimate.

   A `MAX`-per-key join-back removes a correlated anti-join. It still performs one clustered lookup per returned row whenever a projected column is missing from the covering index, so logical reads stay proportional to row count. Compare reads against the version that drops the uncovered column before treating the join-back as the fix.

   Before reshaping on index coverage read off DDL, run an existing sort or filter on the same endpoint that needs none of the suspect work. If that path is as slow or slower, the suspect component is not the bottleneck. An index that fully covers a set-based form may not be seekable for the correlated form, and vice versa.

4. Identify whether the bottleneck is count, page, fan-out join, aggregate, restriction predicate, or in-memory merge.
5. Check full-population restrictions before changing query shape.
6. Apply EF query-shape fixes first when the problem is predicate placement, pagination, staging, projection width, or unnecessary restrictions. A correlated `Count` / `Any` per parent row is N+1 in SQL form: aggregate once at the parent grain, then lookup-join the aggregate.
7. Test one change at a time unless two shape changes are hypothesized as jointly necessary; then measure the combination before concluding either is worthless. Compare timings and row counts.
