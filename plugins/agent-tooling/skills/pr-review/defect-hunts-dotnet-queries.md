# pr-review — .NET query and EF defect hunts

Hunt format and the verification ladder: [defect-hunts.md](defect-hunts.md) and [SKILL.md](SKILL.md).

### N1 — Unproven join-key uniqueness or a missing join-grain key
- **Signal:** a join treated as `1:1` without a unique constraint behind its key, or a join key that omits a column the grouping or the consumer depends on (for example a version, region or effective date). Applies equally to joins in SQL views, procedures, and functions.
- **Verify:** L2, under the uniqueness and reachability rules in "L2 data" in [verification.md](verification.md):
  ```sql
  SELECT COUNT(*) AS Rows, COUNT(DISTINCT CONCAT(KeyA, '|', KeyB)) AS DistinctKeys FROM dbo.SomeTable WHERE <code-path filters>;
  ```
- **Rule:** `{CURSOR}/skills/dotnet-ef-query-optimization/cardinality.md` (Cardinality protocol).
- **Example:** `ToLookup` instead of `ToDictionary` for a `1:N` key.

### N2 — Two uncollapsed fan-outs in one `FROM`
- **Signal:** two `1:N` joins (for example an order's lines and its shipments) composed before a `GroupBy`, or two composed `IQueryable`s presented as stages. The same two joins in a SQL view or procedure count.
- **Verify:** L2. Compare the pre-aggregation row count with the output grain count; L4 with EF command logging for the generated SQL.
- **Rule:** `{CURSOR}/skills/dotnet-ef-query-optimization/cardinality.md` (Hard rules; Staging decision checklist).
- **Example:** none to cite; use the rule.

### N6 — `ExecuteUpdate` or `ExecuteDelete` leaving tracked instances stale
- **Signal:** a bulk `ExecuteUpdateAsync`/`ExecuteDeleteAsync` on rows that the same scoped context already tracks, followed by a tracked read or save.
- **Verify:** L3. A provider-backed test, or trace the later read in the same request.
- **Rule:** `{CURSOR}/skills/dotnet-data-access/writes.md`.
- **Example:** an `ExecuteUpdateAsync` with no tracked instance of the same rows in scope.

### N11 — Entity missing from the EF model
- **Signal:** a new entity used through `Set<T>()` or a generic repository that the model never includes: no `DbSet<T>` on the DbContext, no `modelBuilder.Entity<T>()` or `IEntityTypeConfiguration<T>`, and no navigation from an included entity. This fails at runtime, not at compile time.
- **Verify:** L1; L4 on the endpoint.
- **Rule:** `{CURSOR}/rules/dotnet-entity-naming.mdc`.
- **Example:** the DbContext's existing `DbSet<...>` properties (`git grep -n 'DbSet<' -- '*.cs'`).

### N12 — `EF.Constant` on lists that scale with input
- **Signal:** `EF.Constant(ids)` where the list size follows user data rather than domain structure.
- **Verify:** L4 with `dotnet-endpoint-profiling` at a realistic size, comparing the default emitted form, no predicate, and inlined literals.
- **Rule:** `{CURSOR}/skills/dotnet-ef-query-optimization/restrictions.md` (Contains over an id list), `{CURSOR}/skills/dotnet-ef-query-optimization/triage.md` (Troubleshooting slow EF LINQ, three-shape test).
- **Example:** none to cite; use the rule.

### N13 — `Convert.ToDecimal` rounding in EF projections
- **Signal:** `Convert.ToDecimal` inside an EF-translated projection or comparison. EF emits `CONVERT(decimal(18, 2), ...)`.
- **Verify:** L2. Run the generated SQL fragment with a value that has more than two decimal places.
- **Rule:** `{CURSOR}/skills/dotnet-ef-query-optimization/triage.md` (Verify EF translation, not only LINQ behavior).
- **Example:** none to cite; use the rule.

### N15 — In-memory filtering or paging over inputs known before the query
- **Signal:** `.Where`, `.OrderBy`, `.Skip`, or `.Take` applied to a materialized repository result when the predicate inputs existed before the call.
- **Verify:** L1; L2 for the discarded-row ratio.
- **Rule:** `{CURSOR}/skills/dotnet-ef-query-optimization/read-shape.md` (Core rules), `{CURSOR}/skills/server-side-pagination/SKILL.md`.
- **Example:** none to cite; use the rule.

### N18 — Empty-input guard missing before a `Contains`
- **Signal:** a repository method building `ids.Contains(...)` without first returning early on an empty list.
- **Verify:** L1.
- **Rule:** `{CURSOR}/skills/dotnet-ef-query-optimization/restrictions.md` (Restriction normalization pattern).
- **Example:** `if (ids.Count == 0) return Array.Empty<Widget>();` before the query. A method that returns a public `IQueryable` is not an example.

### N20 — Non-sargable predicate
- **Signal:** a function, arithmetic, `ToString()`, `.Year` or `ToLower()` applied to a column inside a predicate, or a substring `Contains` on a large indexed text column. In T-SQL: a function or scalar UDF on a column in `WHERE` or `JOIN`, a leading-wildcard `LIKE`, or an implicit conversion between mismatched column types.
- **Verify:** L1; L2 plan check only when the query is hot.
- **Rule:** `{CURSOR}/skills/dotnet-ef-query-optimization/read-shape.md` (Sargable predicates); `{CURSOR}/skills/sql-query/perf-diagnostics.md` for plan evidence.
- **Example:** none to cite; use the rule.

### N21 — Per-item, per-key or synchronous round trips
- **Signal:** `await` of repository or EF calls (`AnyAsync`, `FirstOrDefaultAsync`, `SaveChangesAsync`, or `Insert` plus save) inside `foreach`/`for`/`Select`, including inside a transaction; a loop calling a repository, a scalar SQL function, or `SqlQueryRaw(...).AsEnumerable()` once per distinct key; `.ToList()`, `.First()`, or synchronous helpers inside an `async` method.
- **Verify:** L0 statement-count trace; L4 with `{CURSOR}/skills/dotnet-endpoint-profiling/SKILL.md`, counting statements per request before and after; otherwise L2 to count distinct keys for a realistic tenant.
- **Rule:** `{CURSOR}/skills/dotnet-ef-query-optimization/round-trips.md` (Per-row checks, Lookups, Saves), `{CURSOR}/rules/dotnet-async-hygiene.mdc`.
- **Example:** none to cite; use the rule. A synchronous single-key lookup or conversion helper is the shape to avoid in a loop.

### N22 — Unstable paging
- **Signal:** `Skip`/`Take` after an `OrderBy` on a non-unique key only, or a second `OrderBy` replacing the first.
- **Verify:** L1.
- **Rule:** `{CURSOR}/skills/dotnet-ef-query-optimization/read-shape.md` (Stable ordering for `Skip`/`Take`).
- **Example:** `OrderBy(w => w.Name).ThenBy(w => w.Id)` before `Skip`/`Take`.

### N27 — Read-after-write on the readable secondary
- **Signal:** where the codebase routes some reads to a readable secondary (a read-only DbContext or repository, a connection string with `ApplicationIntent=ReadOnly`), a read through it that runs inside a transaction, decides a write, validation or permission check, or reads rows written moments earlier by the same flow or by the code that published its message.
- **Verify:** L0. Trace the write that precedes the read, through the message publish when there is one. Local runs usually cannot show the lag, because both connection strings open the same database.
- **Rule:** `{CURSOR}/skills/dotnet-data-access/SKILL.md` (Choosing a repository type).
- **Example:** a repository method that reads the primary context, beside an injected read-only one, because its callers read a row created moments earlier.
