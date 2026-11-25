# Cardinality protocol and staging

Scope: the grain and multiplicity worksheet applies to any SQL-backed read. Staging and translation details are written for EF Core.

## Cardinality protocol

Name the row grain and the multiplicity of every join **before** writing the first `from`. This protocol is the pre-write gate.

It applies when Query stop item 4 fired (`SKILL.md`), including a collapsed-join extract and a projected column that is added by changing joins.

### Required before the first join

Produce these artifacts before composing joins:

1. **Output grain** in one sentence (“one row per `(OrderId, ProductId)`”).
2. **Multiplicity** of each table vs that grain (`1:1`, `1:0..1`, `1:N`, `?:unproven`).
3. **Collapse plan** for every `1:N`: `EXISTS`, a grouped subquery keyed to the grain, `GROUP BY` *before* the next fan-out, or a grain-boundary `ToListAsync` so EF never sees two `1:N` relations in one `FROM`. Collapse may happen **after** materialization.
4. **Uniqueness** of every join key: proven, unproven, or not unique.
5. **Optionality** when replacing a SQL object: record inner vs left next to multiplicity. An inner join that dropped unmatched rows must not become a left join emitting a default-valued row. Prove the replacement with a multiset row diff against the original, not only matching row counts and an aggregate checksum — a dropped row and a default-valued row can agree on both.

### Hard rules

- Two uncollapsed fan-outs in one `FROM` is invalid.
- Two fan-outs after **separate** `ToListAsync`s are valid; composing those `IQueryable`s is not. A private shared `IQueryable` is not a stage boundary — `ToListAsync` is.
- Unproven uniqueness is not `1:1`. Do not join at that grain. Collapse first (`GROUP BY` / `EXISTS` / `APPLY TOP 1` with a documented tie-break, or a grain-boundary `ToListAsync`).
- A sibling query is not uniqueness evidence. If it `GroupBy`s after the join, treat the join as a multiplier.

### Where the worksheet lives

- **Written plan with tasks:** grain sentence and multiplicity table in the plan's design section. “See skill” is invalid. Query-writing tasks name each collapse point in their implementation notes and list `dotnet-ef-query-optimization` in their read-first references.
- **Plan mode / live session:** worksheet in the plan body or the chat *before* joins. If Planned File Changes include a triggered repository read, the design section must contain the worksheet, and the implementation todo must not be first for that query. Do not make the worksheet a YAML todo agents can check off without producing the table.

### Evidence bar

Same protocol, different proof:

- **Written plan with tasks.**
  - Unproven uniqueness is a planning-stage blocker or a prior task whose only output is uniqueness SQL (`COUNT(*)` vs `COUNT(DISTINCT join keys)` on the local database).
  - Query tasks include grain-count vs post-join-count in their verification steps when `sql-query` capability is confirmed; otherwise characterization row counts plus an explicit residual-risk note.
- **Live / Plan mode.**
  - Run the uniqueness SQL if `sql-query` is available; otherwise fail closed (collapse, never join as `1:1`).
  - Row-count check if `sql-query` is available; otherwise characterization plus residual risk.
- **Both: prove over the widest population.**
  - Run the uniqueness proof over the widest population the query can serve, not the tenant under test. A key that is unique inside one tenant is routinely non-unique across tenants, and a tenant-scoped proof licenses an in-memory `ToDictionary` that throws for some other tenant.
  - When only a scoped proof is obtainable, uniqueness is unproven: build an `ILookup` and `SelectMany`, or collapse with a documented tie-break.
  - State the population scope alongside the counts; two bare numbers read as all-tenant whether or not they are.

Do not require a large-tenant count on every live “add a column” edit. Do not treat unproven uniqueness as a lookup join.

Cost-based optimizer folklore (repeated `CASE`, DOP, temp-table statistics) is not evidence for the worksheet. Measure after the shape is legal.

## Staging decision checklist

**Small-keyset staging.** Stage when:

- The first query returns a small page/keyset that sharply constrains a much larger table.
- Materialized rows are narrow, bounded, and reusable.

**Grain-boundary staging.** Use this **before** a proc/TVF when the output grain is coarse (a group, category or parent) and the inputs are independent `1:N` children of it (for example an order's lines, shipments and payments).

- Materialize each input with its own `ToListAsync`. Do not compose those `IQueryable`s — EF inlines and recreates the cartesian product.
- Large first-stage count is not the veto. Composing that set through another `1:N` input is. A large set of narrow child rows rolled up to a few hundred aggregates is legal; the same rows joined to a second `1:N` input are not.
- Do not rebuild a `UNION ALL` view in LINQ. Query the mapped keyless set with a narrow `.Select`.

Do not stage when:

- The staged query hydrates tens of thousands of **wide** rows so C# can rejoin them. Narrow per-input stages plus C# `GroupBy` are allowed.
- The code merely rebuilds a `UNION ALL` view or composes the same fan-outs EF would have composed in one `FROM`.

### Per-key scalar function calls

Collapsing calls to distinct argument sets does not remove a per-key loop. A scalar SQL function called once per distinct key from .NET is still one round trip per key; collapsing rows to distinct arguments is only half the fix, and a synchronous per-key loop serializes on the request thread.

- Evaluate the set in one statement: project the arguments through a parameterized `VALUES` table and apply the function across it.
- Inject an ordinal column into the `VALUES` list and `ORDER BY` it, return only the function result, then zip by position. Matching on returned argument columns re-derives the key after a round trip through nullability and collation.
- Chunk so `arguments-per-key × keys + 1` stays under SQL Server's 2100-parameter ceiling; that is a hard server limit.
- Bind parameters the way the existing single-key call binds them: a `VALUES` column takes its type from the parameter, not the function signature.
- Verify batched vs single-key against the real database with the same parameter types.
- Do not add a stored procedure to wrap the batched call.

