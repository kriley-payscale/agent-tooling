# Write recipes

Examples write the codebase's generic repository as `IRepository<T>`; use its real methods. Audit-column ownership is in `{CURSOR}/rules/dotnet-audit-fields.mdc`.

## Principal and dependent in one save

Set the dependent's reference navigation to the principal, add both, and save once. EF fixes up the FK from the tracked principal and propagates the generated identity. The implicit save transaction replaces an explicit `BeginTransaction` that only existed to sequence two saves.

```csharp
dependent.Parent = parent;
_parentRepo.Add(parent);
_dependentRepo.Add(dependent);
await _parentRepo.SaveChangesAsync();
```

Do not rely on adding the principal to also insert an untracked dependent hanging off its navigation unless SQL Server evidence shows it does: a wrapper that sets `Entry(entity).State = EntityState.Added` can attach only that entity, not its graph. Mocked repository tests can assert the navigation link but not FK propagation; prove that against SQL Server.

## Bulk writes

Bulk-extension writes (EFCore.BulkExtensions `BulkInsertAsync` / `BulkUpdateAsync`) bypass `SaveChanges` and the change tracker, so whether audit columns are stamped depends on the codebase's wrapper (rule `dotnet-audit-fields`). The size threshold is in rule `dotnet-repositories`.

## Predicate-based batch update (no entity load required)

```csharp
await _repo.ExecuteUpdateAsync(
    x => x.TenantId == tenantId,
    setters => setters
        .SetProperty(x => x.Status, WidgetStatus.Inactive)
        .SetProperty(x => x.ModifiedBy, userId)
        .SetProperty(x => x.ModifiedAt, DateTime.Now));
```

`ExecuteUpdate`, and a bulk library's batch update, bypass change tracking, so the setters stamp the modified columns themselves (rule `dotnet-audit-fields`).

When splitting a large update or delete into batches to avoid table locks, make each batch's predicate seek straight to that batch's rows, for example by passing the batch's keys. SQL Server counts locks per statement and per index, including every row the statement reads, so a batch that scans the whole parent before filtering escalates to a table lock whatever the batch size.

## Batch delete of rows the context already tracks

When a write batch-deletes rows (`ExecuteDeleteAsync` or a bulk library's batch delete) that the same scoped context already tracks, and then deletes their principal through the tracker with a cascading relationship, the save throws `DbUpdateConcurrencyException` and rolls back: the batch delete bypasses the tracker, so the cascade deletes a row that is already gone. Delete the dependent through the tracker instead (load it tracked, then delete it), or detach it first.

## Saving without an acting user

When the codebase's save takes the acting user, save without one only in background jobs where no real user exists, and pass the codebase's system-user value if it has one.

## Relational write ordering for FK-sensitive writes

When one transaction updates or nulls a dependent foreign key and deletes or replaces its principal:

1. Persist the dependent unlink before deleting the principal, using a separate `SaveChangesAsync` inside the existing transaction. Confirm a transaction wraps both saves; open one at the service layer if none does.
2. When the model maps foreign keys as scalar properties (see `{CURSOR}/rules/dotnet-entity-naming.mdc`), do not add a relationship to make EF order the commands. Where a relationship already exists, keep its `DeleteBehavior` aligned with the database's referential action; do not infer a one-to-one enum mapping or introduce cascade semantics the database does not have.

SQL Server error 547 is a signal to check save ordering and any existing relationship metadata before rewriting business logic. Mocked service tests and EF InMemory cannot prove relational constraints or modification-command ordering; require SQL Server-provider-backed integration evidence or a live write against the local database for FK-sensitive paths.

## Revalidating preloaded input inside a transaction

When a transactional write revalidates input that was loaded before the transaction opened, compare against a fresh run of the same derivation that produced the preloaded input, not against the raw source rows. Derivations routinely drop rows (unknown catalog entries, unsupported families, soft-deleted references). A raw comparison therefore fails permanently for any parent that holds a dropped row, and the failure looks like a concurrency conflict that a retry can never clear.

- Compare on the identity the write actually consumes: the row id plus the derived key it writes under.
- Keep any delete scope on the raw rows if the existing write already clears them.

## Re-assigning values on a unique-indexed column across rows of one parent

When a write reorders or swaps values (positions, ranks, slots) on a column with a unique index, and possibly a range `CHECK`, do not update row by row. Per-row tracked updates, or one `ExecuteUpdateAsync` per row, are separate statements. SQL Server validates uniqueness once per statement, so a swap can collide on the index between two of them, and a range `CHECK` can leave no free temporary value to park a row in.

Apply every new value in ONE set-based `ExecuteUpdateAsync(predicate, setters)` whose setter is a conditional expression built from the id-to-value map:

```csharp
await _lineRepo.ExecuteUpdateAsync(
    x => x.OrderId == orderId && (x.Id == idA || x.Id == idB),
    setters => setters
        .SetProperty(x => x.Position, x => x.Id == idA ? positionA : x.Id == idB ? positionB : x.Position)
        .SetProperty(x => x.ModifiedBy, userId)
        .SetProperty(x => x.ModifiedAt, now));
```

- The setters must also stamp the modified-by and modified-at columns. `ExecuteUpdate` bypasses `SaveChanges` stamping.
- Never write the new value on tracked entities of the same rows. A later `SaveChangesAsync` would re-emit per-row updates and reintroduce the collision.
- Order inside the transaction: delete removed rows and save, reposition survivors, then insert new rows at their final values and save.
- EF InMemory fixtures throw on `ExecuteUpdate`; route the call through the generic-repository seam (next section) and prove the statement against SQL Server.

## Relational-only DML and the generic-repository seam

A specialized repository that calls bulk-extension writes or `ExecuteUpdate` / `ExecuteDelete` on its own `DbContext` cannot be characterized on the EF InMemory provider, which repository fixtures often use (`{CURSOR}/skills/unit-test-guidance/dotnet-domain-repository-fixtures.md`, "Relational-only operations").

The seam belongs **inside the specialized repository**, not on the service. When the production change calls for the write pattern in rule `dotnet-repositories`, take the generic repository as a constructor parameter for the entities that repository owns, route DML through it and save once. Do not introduce this seam solely to accommodate a test. It is not the banned bounce: that ban is on the *service* injecting the generic repository for entities the specialized repository already owns.

The seam preserves an ambient transaction when the DbContext and the open-generic repository are both registered scoped and the generic repository takes that DbContext: within one request scope, the generic repository and the specialized repository hold the same context instance, so a transaction opened on that context covers writes issued through the seam. Verify the registration lifetimes before relying on this inside a transaction.

Do not branch a write on provider type; route it through the seam. The one provider branch allowed is the table-valued-parameter read in `{CURSOR}/skills/dotnet-ef-query-optimization/restrictions.md`.
