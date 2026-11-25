# Restrictions and Contains

Scope: EF Core on SQL Server.

## Contains over an id list

Materialize local ID sets used by EF `Contains` predicates as `List<T>`, not arrays. On .NET 8 (observed on .NET 8; unverified on net10.0), an array captured by the expression can compile but fail during EF parameter extraction with `InvalidOperationException` wrapping an `ArgumentException` that mentions `ReadOnlySpan<T>` and `FuncCallInstruction<T0,TRet>`. Change `.ToArray()` to `.ToList()` before composing the query.

### How a captured list reaches SQL

It depends on the EF Core version and the DbContext's configuration. Read the `Microsoft.EntityFrameworkCore` package version, then search the context and its `AddDbContext` options for `UseParameterizedCollectionMode` and `TranslateParameterizedCollectionsToConstants`:

- **EF Core 8 and 9:** one `nvarchar(max)` JSON parameter read with `OPENJSON` at every list size, unless EF Core 9's `TranslateParameterizedCollectionsToConstants()` inlines the values. EF Core 7 and earlier inline them as constants.
- **EF Core 10 with no `UseParameterizedCollectionMode` call (its default):** scalar parameters, `IN (@ids1, @ids2, ...)`, up to 2,097 ids in a query with one other parameter (measured on 10.0.10), and past that the `OPENJSON` form below. The cutoff follows the command's total parameter count, not the list length alone. Scalar lists did not carry the row guess below.
- **EF Core 10 with `UseParameterizedCollectionMode(ParameterTranslationMode.Parameter)`:** the `OPENJSON` form at every list size, and `EF.Parameter` adds nothing. `ParameterTranslationMode.Constant` inlines the values.

Re-measure logical reads on any `Contains` path whose baseline predates an EF Core upgrade or a change to that setting.

The `OPENJSON` form is a TVF with no statistics (documented by Microsoft). The optimizer assigns a fixed low row guess (~50) regardless of actual count, and the error compounds through every join above it into nested loops whose inner side is re-seeked once per candidate.

What follows:

- In every form above, SQL Server's 2100-parameter ceiling does not fail a single large `Contains`, and chunking that `Contains` to stay under it is wrong: extra round trips, and multi-list intersections get harder to express. The 2100 ceiling applies where the code emits one parameter per value (raw SQL `VALUES` / `IN` lists), which is the `VALUES` batching in `cardinality.md` (Per-key scalar function calls).
- When a reviewer or bot reports a 2100 failure on an EF Core `Contains`, confirm it in the executed command text before chunking.
- In the `OPENJSON` form, the cost of a `Contains` over a captured list is the ~50-row guess above, at every list size.

When the id set was itself derived from a query the database can run, join that source table and inline its predicates, but only after measuring how selective the restriction is.

- Joining the source replaces a bad cardinality estimate with the join's own cost. That trade only pays when the derived set removes a large share of the target, including on the widest workload, not just a narrow sample.
- When the derived set covers nearly the whole table, the join forces every read through the deriving tables to remove almost nothing, and a round-tripped id list is faster despite the `OPENJSON` guess.
- The same endpoint can want the join at one input size and the id list at another. When they conflict, the id list is the safer default because its cost scales with the ids rather than with the deriving join.
- Caller-supplied lists still use `Contains`.

When that measurement favors the source, compose the eligibility query as an `IQueryable<int>` (`var eligibleIds = source.Where(...).Select(x => x.Id);`) and restrict with `eligibleIds.Contains(row.ParentId)`. Do not `ToListAsync()` the ids first. EF emits `IN (SELECT ...)`, a semi-join: it cannot multiply target rows the way a plain join to the source can, it does not duplicate the eligibility predicates into the outer query, and the optimizer plans it from real histogram statistics and memory grants instead of the `OPENJSON` guess.

When an access-scope or authorization list can cover a large share of the tenant's rows, and the database defines a table type for id lists (search the schema source for `CREATE TYPE` ... `AS TABLE`), pass the list as a table-valued parameter composed into the query rather than a captured-list `Contains`.

- Build a `SqlParameter` with `SqlDbType.Structured`, `TypeName` set to the table type's name and a `DataTable` of the ids as `Value`, and restrict with `context.Database.SqlQuery<int>($"SELECT [Id] AS [Value] FROM {idsParameter}").Contains(row.Id)`, using the type's id column.
- The `OPENJSON` guess stays at 50 rows however many ids the role allows; the table-valued parameter is a table with a real row count.
- The in-memory test provider cannot run SQL, so branch on `Database.IsSqlServer()` and keep the plain `Contains` there. This read is the only place production code branches on provider type.
- Re-check join order afterwards: when the type's id column is nullable or its index non-unique, the optimizer still guesses how many ids are distinct.
- Without such a type, adding one is a schema change (rule `dotnet-entity-naming`, Schema ownership); propose it with the measurement.

Before stacking a second `Contains` on a query that already has one, count how many rows the extra predicate would drop from the *current* result. Distinct of the new id list being small is not that count. A small second list that already covers almost every current row buys nothing, and a second `OPENJSON` can multiply CPU while leaving logical reads unchanged. Kill the extra predicate unless it removes a large share of the already-restricted rows.

When the captured list stays a `Contains` (not a join to the source) in the `OPENJSON` form, it carries the 50-row guess. `EF.Constant` inlines the values, so the optimizer plans against them instead of the guess.

- Wrap a list in `EF.Constant` only when it is small, bounded by domain structure, and drives join order.
- Treat a list that grows with tenant data as unbounded even when domain structure bounds it. A statement with several thousand inlined values can fail to compile with Msg 8623 ("query processor ran out of internal resources"); one that used its list four times compiled at 4,000 values and failed at 5,000. Chunk below about 3,000 values per statement or keep the list parameterized.
- Do not apply `EF.Constant` to access-scope or permission restriction lists: those are unbounded by design and inlining them emits unusable SQL.
- Decide per list, not per query. Two lists in the same predicate routinely need opposite treatment.
- Call `EF.Constant` inside the query lambda: name the list and pass that name in. It changes translation only when the call itself is inside the query expression tree. Assigning `EF.Constant(...)` to a local the query then captures, or wrapping it in a helper the provider cannot inline, drops the constant annotation and the list is parameterized again.
- Because the SQL text changes, the two forms occupy separate plan-cache entries, which makes a before/after directly comparable.

An aggregate subquery (`GROUP BY` with `MAX`/`COUNT`) resists being unnested into a per-row correlated seek. A semantically identical `DISTINCT … WHERE col > 0` semi-join gets flattened into exactly that. Prefer the aggregate form when the inner table is large. These two changes — drop the round-tripped id list, and use the aggregate subquery — can be jointly necessary and individually worthless. Measure the combination before concluding either does not matter.

## Restriction normalization pattern

```csharp
var allowedIds = accessScope?.AllowedIds?.Distinct().ToList();
if (allowedIds != null && allowedIds.Count == 0)
{
    return Array.Empty<ResultRow>();
}

allowedIds = await NormalizeRestrictionAsync(tenantId, allowedIds);

if (allowedIds != null)
{
    query = query.Where(row => allowedIds.Contains(row.Id));
}
```

When `allowedIds` can cover a large share of the tenant's rows, restrict with the table-valued parameter from Contains over an id list, where the database has one, instead of `allowedIds.Contains`.

`NormalizeRestrictionAsync` is a placeholder: it returns `null` when the list covers the full population. Search for an existing normalization helper before writing one in the repository.

Return before building the query when the list is empty: empty means no access, and it saves a statement. The failure mode of an empty `Contains` on EF Core 10 has not been measured.

### Restrictions inside a query-syntax read

For a `from … join … where …` read, do not write `(allowedIds == null || allowedIds.Contains(x))` inside the `where`. SQL then carries the unrestricted branch, and the optimizer builds one plan for both cases. Apply the restriction to the entity source instead: declare the `DbSet` as a local `IQueryable<T>`, filter it when the list is non-null, and use the local as the `from` or `join` source.

```csharp
var rows = context.Rows.AsNoTracking();
if (allowedIds != null)
{
    rows = rows.Where(row => row.ParentId.HasValue && allowedIds.Contains(row.ParentId.Value));
}

var query =
    from row in rows
    join parent in context.Parents on row.ParentId equals parent.Id
    select new ResultRow { /* ... */ };
```

This needs no projection restructure, keeps `null` as unrestricted and an empty list as no rows, and moves any `.HasValue` guard into the source filter.

- For a query built as a `Concat` of independent halves, apply the restriction to each half's own sources. Do not apply it to an anti-join that only keeps the halves disjoint.
- Before adding the restriction to a downstream query, check whether its input already carries the same restriction from the method that built it. If so, drop the duplicate instead of rewriting it.
