# Domain repositories

## Calling a stored procedure from a repository

When an approved stored-procedure call exists, pass the parameters to `FromSqlRaw` as an array: `parameters.ToArray()` binds each `SqlParameter`. A `List<SqlParameter>` or other sequence passed without `ToArray()` becomes a single argument, and the query throws `InvalidOperationException` (`The current provider doesn't have a store type mapping for properties of type 'List<SqlParameter>'`) when it runs, not at compile time.

```csharp
var parameters = new List<SqlParameter>
{
    new SqlParameter("@TenantId", tenantId),
    new SqlParameter("@CategoryId", (object)categoryId ?? DBNull.Value),
};

var rows = await dbContext.Set<WidgetSummaryRow>()
    .FromSqlRaw("EXEC dbo.GetWidgetSummary @TenantId, @CategoryId", parameters.ToArray())
    .AsNoTracking()
    .ToListAsync();
```

## Adding a domain repository query

### Step 1 — Confirm a domain repository is actually needed

Read rule `dotnet-repositories` and verify the use case satisfies at least one condition in its "Feature repository" section before proceeding. If none apply, inject the generic repository directly into the service — no new repository class needed.

### Step 2 — Read a sibling file first

Before writing a new domain repository method, read a sibling method in the same file or a sibling file in the same folder. For a multi-table query, read the closest existing method that uses query syntax, left joins with `DefaultIfEmpty()` and a projected result. Establish:

- The DbContext member the file already uses. A net-new file follows rule `dotnet-repositories`, Constructor shape.
- Existing `DbSet` references used in the file
- Return type conventions (`Task<IEnumerable<T>>` vs `IEnumerable<T>`)

### Step 3 — Choose query syntax vs method-chain syntax

#### Use query syntax when the query has left joins

```csharp
public async Task<IEnumerable<MyProjection>> GetAsync(int[] parentIds)
{
    if (parentIds == null || parentIds.Length == 0)
        return Array.Empty<MyProjection>();

    var idList = new List<int>(parentIds);

    var rows = await (
        from primary in dbContext.PrimaryTable.AsNoTracking()
        join secondary in dbContext.SecondaryTable
            on primary.SecondaryId equals secondary.Id into secondaryGroup
        from secondary in secondaryGroup.DefaultIfEmpty()
        join lookup in dbContext.LookupTable
            on primary.LookupId equals lookup.Id
        join optional in dbContext.OptionalTable
            on primary.OptionalId equals optional.Id into optionalGroup
        from optional in optionalGroup.DefaultIfEmpty()
        where idList.Contains(primary.ParentId)
        orderby primary.Score descending
        select new MyProjection
        {
            Id          = primary.Id,
            Name        = secondary != null ? secondary.Name : null,
            LookupValue = lookup.Value,
            OptionalVal = optional != null ? optional.SomeField : null,
        }
    ).ToListAsync();

    return rows;
}
```

For a `Contains` over an id list, or an access list that must be normalized or applied, read `{CURSOR}/skills/dotnet-ef-query-optimization/restrictions.md`.

#### Use method-chain syntax for single-table queries

```csharp
public async Task<IEnumerable<Widget>> GetByTenantAsync(int tenantId)
{
    return await dbContext.Widgets
        .AsNoTracking()
        .Where(x => x.TenantId == tenantId && x.Active)
        .OrderBy(x => x.Name)
        .ToListAsync();
}
```

### Step 4 — Left join rules

Every left join needs the `into` / `DefaultIfEmpty()` pair; a plain `join` is an inner join. When projecting from a left-joined range variable, guard against null. An unguarded property projects null, and C# code that later dereferences it throws.

```csharp
Field = nav != null ? nav.Field : null,
```

When two optional sources supply the same field, coalesce them:

```csharp
OwnerId = primary.OwnerId ?? (owner != null ? owner.Id : null),
Owner   = owner ?? fallbackOwner,
```

That guard is for values projected into results. A relational comparison over a nullable value from a left-joined element (`Where(x => x.MaxValue > 0)`, `IsFlagged = x.MaxValue > 0`) is a lifted comparison that returns `bool`, with null comparing false. Use it bare in predicates and aggregate flags; EF translates it null-safely on SQL Server and on EF InMemory, including rows where the left-joined element is null.

### Step 5 — Required structural rules

- Put `.AsNoTracking()` on the root `from` clause, or the root of a method chain.
- Materialize inside the repository with `await (...).ToListAsync()`.
- Return `Array.Empty<T>()` before building the query when an input id list is empty: an empty list means no access, and the guard saves a statement.
- Return `Task<IEnumerable<T>>`. Callers may project or compose over the returned grain, not restrict it.
- Public methods do not return `IQueryable<T>`; a private `IQueryable` shared inside the class is the extract for duplicated joins. Both rules are in rule `dotnet-repositories` ("Feature repository").

### Step 6 — Register the interface in DI

Register the new interface beside the sibling repositories' registrations (search for a sibling repository interface name to find them):

```csharp
services.AddScoped<IWidgetRepository, WidgetRepository>();
```

A generic repository registered as an open generic needs no registration; only domain-specific interfaces do, unless the codebase registers repositories by convention.
