# Repository fixtures on a real `DbContext`

When the SUT is a repository or query class on a real `DbContext` (not a mocked data layer), copy a sibling repository fixture and its provider (EF Core InMemory, SQLite or a test database). Do not copy a service test. When the test project has a `DbContext` subclass or factory for tests, build the fixture on it.

Required:

- Unique InMemory database name per `[SetUp]`: `$"{nameof(TheFixture)}_{Guid.NewGuid()}"`.
- Wide entities: in the test context's `OnModelCreating`, `Ignore` every property the query does not use. Leaving the full type mapped pulls its navigation graph into the test model, where InMemory model creation can fail.
  Do not `Ignore` a property that the context's `SaveChanges` looks up by name (`entry.Property("CreateDate")`) for an entry state the fixture saves, often only `Modified`: the save throws `InvalidOperationException: The property '<Entity>.CreateDate' could not be found`. Properties the context sets through CLR setters may stay ignored. If such a property must stay ignored, seed the final state at creation, or add a superseding row instead of updating a seeded row and saving.
- Keyless views: after `base.OnModelCreating`, when an InMemory fixture must seed a production `ToView` + `HasNoKey` type, remap that entity only with `ToTable(...)` then `HasKey(...)`. Otherwise `DbSet.Add` throws `Unable to track an instance of type 'X' because it does not have a primary key`. Use a composite key that matches the query grain. Do not change the production context's mapping. InMemory still does not prove view translation.
- Shared parents: when seeded children share a parent, check `_context.Parents.Local.Any(...)` before `Add`. Seeding two children with the same parent Id throws an EF identity conflict.
- Transaction tests (`BeginTransactionAsync`): `.ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))`.
- Treat InMemory results as semantic evidence only. They do not prove SQL Server translation.
- A query assembled as a `Concat` or `Union` of independent halves needs a row through each half: [dotnet-characterization.md](dotnet-characterization.md).

## Relational-only operations

The EF InMemory provider throws on `ExecuteDelete`/`ExecuteUpdate` and on the EFCore.BulkExtensions `BatchDelete`/`BulkInsert` family, because all of them require a relational provider. A repository that calls `BulkInsertAsync` / `BulkUpdateAsync` / `ExecuteDeleteAsync` on its own `DbContext` cannot be characterized on InMemory at all.

First check existing coverage and whether the repository already routes that DML through an injectable seam; use focused local SQL verification for the remaining provider behavior. Whether and where to add a seam is production design, covered by the relational-only DML section of `{CURSOR}/skills/dotnet-data-access/writes.md`; do not introduce one solely to accommodate a test.

Where the sibling fixtures use InMemory, a new or converted relational fixture (SQLite or a real SQL Server database) needs a specific recurring regression risk that simpler coverage cannot catch; an InMemory limitation alone does not justify it. Where they already run on SQLite or a test database, use that provider.

Do not widen visibility for a test: do not make a private query `internal`, and do not add `InternalsVisibleTo` for the test project. Where the assembly already grants it, a test may call a member that is already `internal`. When neither a suitable seam nor a justified relational fixture applies, drop the InMemory tests that would require widening private helpers or adding new internals. Live SQL remains the proof for the DML.

## Audit columns on save

This applies when the context stamps audit columns in `SaveChanges` (an override or an interceptor). The stamping runs on every save, including the fixture's seed save, so values seeded into stamped columns do not survive it unless the codebase has an opt-out. Assert around the stamping rather than disabling it in a test context, which would test a save production never runs.

To assert stamping on the act's save:

1. Seed through the context's save as a seed user distinct from the acting user.
2. To keep a seeded edit date, use the codebase's opt-out if it has one (often an unmapped flag on the entity). Without one, assert against the edit date read back after the seed save, not the constant you set.
3. Call `ChangeTracker.Clear()` before the act, so the system under test loads rows as production does; an unmapped opt-out flag resets there and the act's save stamps normally. Clear again before reading the result.
4. Assert that create-user still equals the seed user, edit-user equals the acting user, and the edit date is later than the seeded one.

Fixtures that do not assert those columns need none of this.
