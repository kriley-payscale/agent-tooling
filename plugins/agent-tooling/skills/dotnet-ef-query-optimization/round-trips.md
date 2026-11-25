# Round trips

Every awaited repository or EF call is at least one SQL statement. On a request path the statement count must not grow with input size. Measure it by statement count, not by wall time on a small dataset; see skill `dotnet-endpoint-profiling`.

## Per-row checks

Do not await an ownership or existence check per row.

```csharp
// wrong: one statement per id
foreach (var id in ids)
{
    if (!await repository.GetQueryable().AnyAsync(x => x.Id == id && x.TenantId == tenantId))
        // reject the request
}

// right: one statement per request
var ownedCount = await repository.GetQueryable()
    .Where(x => ids.Contains(x.Id) && x.TenantId == tenantId)
    .CountAsync();
```

Compare the result with the distinct input count. Large id lists and their normalization belong to `restrictions.md`.

## Lookups

Load a lookup once, before the loop, and read it in memory. If the key may repeat, uniqueness is unproven; see `cardinality.md` before choosing a dictionary over a lookup.

## Saves

- Never call `SaveChangesAsync` inside a loop, or through a helper that saves, once per item. Stage the changes and save once.
- Past the bulk threshold, use the bulk methods. The threshold and who may call `SaveChanges` are in rule `dotnet-repositories`.
- Do not overlap calls to fix a loop. Overlapping work on one scoped context is banned by rule `dotnet-async-hygiene`.

## Transactions

A loop of awaited calls inside a transaction holds its locks for the whole loop, so a per-item loop there blocks other requests as well as costing round trips. Collapse the loop first, then keep the transaction as short as the unit of work allows.
