---
name: dotnet-ef-query-optimization
description: Use when changing per-item repository calls, post-materialization filtering/sorting/paging, id-list restrictions, complex joins, correlated subqueries, shared IQueryable extracts or server paging, or investigating slow EF Core reads or translation. Simple lookups/projections skip it unless slow.
disable-model-invocation: true
---

# Performance-first EF LINQ query design

## Guidance map

| When | Read |
|---|---|
| Query stop item 4 fires, a lookup key may repeat, or a read is being staged into several queries | [cardinality.md](cardinality.md) |
| Filtering, sorting, projecting or paging a read, writing a predicate, or ordering for `Skip`/`Take` | [read-shape.md](read-shape.md) |
| A `Contains` over an id list, or an access list that must be normalized or applied | [restrictions.md](restrictions.md) |
| Awaiting repository or EF calls per item, saving in a loop, or looping inside a transaction | [round-trips.md](round-trips.md) |
| A query is slow or returns wrong rows, or a changed query shape needs its translation verified | [triage.md](triage.md) |
| Gathering plan, logical-read, plan-cache or missing-index evidence, or row counts on the local database | skill `sql-query` |
| Measuring request latency or attributing time to SQL | skill `dotnet-endpoint-profiling` |
| An index or schema change is proposed | skill `sql-object` |
| Wiring a server-side grid paging contract end to end | skill `server-side-pagination` |
| Two EF calls would overlap on one scoped context | rule `dotnet-async-hygiene` |
| Deciding who calls `SaveChanges`, the bulk threshold or transactions | rule `dotnet-repositories` |
| Choosing a repository type or a generic repository method | skill `dotnet-data-access` |

## Query stop

Stop and open this skill before writing or changing code that:

1. awaits a repository or EF call inside a loop or per-item lambda;
2. applies `Where`/`OrderBy`/`Skip`/`Take`/`Count`/`Any` to an already-materialized repository result whose inputs existed before the call;
3. restricts with a list via `Contains`, or builds/normalizes an access list;
4. joins 3+ `DbSet`s or a large `1:N` child table, left-joins with unproven uniqueness, embeds a correlated `Count`/`Any`/`Select`, or extracts a shared `IQueryable`;
5. pages or sorts server-side with `Skip`/`Take`.

Not for a PK lookup, a single-table `Where`/`Select`, or adding a projected column.

## Slow-query trigger

A request that calls a query slow, or slow in production, is itself a trigger, even for a single-table `Where`/`Select`; this overrides the "Not for" line above. Before proposing any change, including an index, start at [triage.md](triage.md) ("Troubleshooting slow EF LINQ").

## Pre-write checklist

Answer all six before writing the query. Write the answers in the plan's design section, the plan body, or the chat. "See skill" is not an answer.

1. Output grain and multiplicity of every join (`cardinality.md`) when a cardinality trigger fires.
2. Statement count: constant in input size, or one await per item? (`round-trips.md`)
3. Is every restriction whose inputs exist before the call inside the query, with no filter/sort/page over materialized rows? (`read-shape.md`)
4. Are predicates sargable: bare column comparison, no function on the column? (`read-shape.md`)
5. Lists: full-population normalized to `null`, empty means none, restriction applied to the source, no stacked `Contains`. (`restrictions.md`)
6. Paging has a unique ordering key and pages IDs before hydrating. (`read-shape.md`, skill `server-side-pagination`)

## Scope

EF Core on SQL Server. Where a behavior depends on the EF Core version or the DbContext's configuration, the leaf says so; check both in the codebase before relying on it.

## Stored procedures and TVFs

For repository read paths, follow the codebase: where sibling repositories read through stored procedures, new reads beside them do too. Otherwise default to C# EF LINQ queries that project the correct data shape, and do not recommend stored procedures or TVFs as an optimization path for new or slow LINQ reads.

**When EF LINQ provably cannot express the winning shape.** Optimize the LINQ shape first — that is still the default and most slow reads end there. Grain-boundary `ToListAsync` (each independent `1:N` input materialized separately, then rolled up in memory) is still LINQ. It does **not** need this sign-off. A large first-stage row count is not "LINQ cannot express this."

Some shapes are outside LINQ's reach entirely: temp tables with explicit indexes to force materialization between stages, and splitting a non-seekable `col IS NULL OR col = @p` disjunction into separate seekable branches. If a measured alternative needs either, say so explicitly rather than optimizing around it.

Stop and present the following to the user for approval before replacing a LINQ read with a stored procedure or TVF:

- the measured before/after (elapsed **and** logical reads);
- a correctness diff proving identical output;
- the specific construct LINQ cannot emit.

This is a sign-off decision, never a silent override, and "I think a proc would be faster" does not reach it.

Any such rewrite has no compiler checking its equivalence. Run both shapes into temp tables and compare row counts, keys present on only one side (`EXCEPT` both directions), integer columns exactly, nullness per column, and numeric columns within an explicit epsilon. Zero mismatches on every column, or it is not a behavior-preserving rewrite.
