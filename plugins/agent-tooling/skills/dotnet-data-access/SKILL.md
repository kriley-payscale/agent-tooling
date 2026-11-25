---
name: dotnet-data-access
description: "Use when writing or reviewing .NET repository reads or writes, including choosing a generic, read-only or per-call repository (primary versus read replica, parallel reads), generic repository method selection, SaveChanges ownership, specialized-repository versus service writes, WithoutSave, transactions and write ordering, domain-repository scaffolding, private IQueryable extracts, left joins, duplicated joins or query-assembly extracts."
disable-model-invocation: true
---

# .NET Data Access Patterns

Examples write the codebase's generic repository as `IRepository<T>`; use its real name and methods.

## Guidance map

| When | Read |
|---|---|
| Writing an insert, update, delete, bulk or batch write, including FK-sensitive ordering, revalidation inside a transaction, unique-index reassignment and the relational-only DML seam | [writes.md](writes.md) |
| Adding a domain repository or a multi-table query method to one, or calling a stored procedure from a repository | [domain-repository.md](domain-repository.md) |
| Deciding whether the service or a specialized repository writes and saves, or who opens a transaction | rule `dotnet-repositories` |
| A read awaits per item, filters materialized rows, restricts by a list, joins several tables or pages server-side, or a read is slow | skill `dotnet-ef-query-optimization` |
| Running repository calls in parallel, or a file uses `ConfigureAwait` | rule `dotnet-async-hygiene` |

## Choosing a repository type

Find the generic repositories the codebase registers: `rg -n -F "Repository<>)" {DOTNET} -g '*.cs'` lists the open-generic registrations, which name each interface and class. A codebase that reads a replica or runs parallel reads often has variants that differ in the database they read and how long their EF context lives. Use the variants that exist; do not add one for a single read.

| Variant | Database | Context | Use for |
|---|---|---|---|
| Generic (default) | Primary | The request's scoped DbContext | Writes, and the reads listed under this table |
| Read-only | Readable secondary or replica | A scoped read-only DbContext | Display, report and export reads, and supporting reads in indexers and batch jobs, that can miss a write from the last few moments. It offloads the primary and never waits on writers |
| Per-call | Primary, or the replica for reads that can miss a recent write | A new DbContext per call | Reads inside `Parallel.ForEach` or `Parallel.ForEachAsync` branches, which cannot share the scoped context |

Read the primary when the read runs inside a transaction, decides a write, validation or permission check, or must see a row committed moments earlier: a re-read after a create, or a message handler or indexer reading the rows its message was published for. A replica lags such a commit only where one is deployed; when local configuration points both connection strings at one database, tests and local QA never show the lag. When unsure, read the primary.

- A typed repository reads the replica by injecting the read-only DbContext beside the primary one, and chooses per query by the same test.
- The read-only variants cannot write or save.
- Per-call variants read on their own connection, so they cannot see the request's uncommitted rows. Materialize inside the call: a method that returns a deferred query over its already-disposed context fails when enumerated, and unit-test fakes over in-memory lists hide that. A typed repository read that runs in parallel branches opens its own context the same way (`await using var context = await contextFactory.CreateDbContextAsync()`). Before parallelizing reads, try one set-based query (skill `dotnet-ef-query-optimization`).

## Generic repository method selection

Read the generic repository's public methods before choosing one: which return `IQueryable<T>`, which have already materialized (`IEnumerable<T>`, `List<T>`), and which queryables are tracked.

- **One row by primary key:** a `FindAsync`-based method checks the change tracker before querying.
- **Existence only:** `AnyAsync(predicate)` on the queryable sends one `EXISTS` query. Never materialize the matching rows and then call `.Any()`.
- **Composing:** a method that returns a materialized sequence has already fetched every matching row, so `GroupBy`, `OrderBy`, `Take` or `Count` chained after it run in memory on the app server. Compose on the `IQueryable<T>` and materialize last.
- **Wide entities:** project only the columns you need. For a single row use `FirstOrDefault` (not `First`) and null-check the result.
- **Eager loading:** a wrapper may take string include paths (`"Parts.Supplier"`) instead of `Include(x => x.Parts)`; read its overloads.
- **Tracking:** a no-tracking queryable returns entities whose changes EF will not detect. Load with tracking, or by primary key, when you will modify them, and do not add `.AsNoTracking()` to a queryable that already applies it.

```csharp
// wrong: GetAll has materialized, so the grouping and Take run in memory over every row
_repo.GetAll(x => !x.Failed)
     .GroupBy(x => x.Date)
     .Select(g => new { g.Key, Count = g.Count() })
     .Take(10)
     .ToList();

// right: compose on IQueryable and materialize last
await _repo.GetQueryable()
           .Where(x => !x.Failed)
           .GroupBy(x => x.Date)
           .Select(g => new { g.Key, Count = g.Count() })
           .Take(10)
           .ToListAsync();
```

## Writes

Whether the service or a specialized repository writes and saves, `WithoutSave`, and who opens a transaction are in rule `dotnet-repositories` ("Where writes and SaveChanges live" and "Transactions for multi-entity atomic writes").

- Before designing a write contract, search for and read representative existing write paths, not only a sibling for syntax.
- If no established pattern fits, surface the proposed architecture and trade-offs for explicit approval before implementing it.
