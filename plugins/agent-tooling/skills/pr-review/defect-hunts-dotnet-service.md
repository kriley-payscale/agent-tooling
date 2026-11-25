# pr-review — .NET service, tenancy and API defect hunts

Hunt format and the verification ladder: [defect-hunts.md](defect-hunts.md) and [SKILL.md](SKILL.md). Tenancy hunts (N9, N10, N23) apply when the application scopes data by a tenant key; examples use `TenantId`, so substitute the codebase's own key and the way it resolves the caller's tenant.

### N4 — Overlapping DbContext operations
- **Signal:** `Task.WhenAll` over EF calls, or a second `*Async` call started before the first is awaited, against one scoped DbContext in a request, directly or through repositories that share it.
- **Verify:** L1 is enough; L4 shows `A second operation was started on this context instance`. EF InMemory may not reproduce it.
- **Rule:** `{CURSOR}/rules/dotnet-async-hygiene.mdc`.
- **Example:** none to cite; sequential `await` is the rule.

### N5 — Tracked entities leaking to services
- **Signal:** a public repository method that returns tracked entities for the service to mutate and save through another repository.
- **Verify:** L1.
- **Rule:** `{CURSOR}/rules/dotnet-repositories.mdc` "Where writes and SaveChanges live" (banned bounce, no public tracked handle).
- **Example:** none to cite; use the rule.

### N7 — Dead `modifiedDate` or caller-owned audit parameters
- **Signal:** where the codebase stamps audit columns centrally (a `SaveChanges` override, a `SaveChangesInterceptor`, or an audited base entity): repository parameters assigned to those columns, entities redeclaring them instead of inheriting the base, or a bulk write that skips the central stamping and stamps by hand.
- **Verify:** L1 by tracing to the central stamping (`git grep -n -E 'override .*SaveChanges|SaveChangesInterceptor' -- '*.cs'`).
- **Rule:** `{CURSOR}/rules/dotnet-entity-naming.mdc` (Audit columns), `{CURSOR}/rules/dotnet-audit-fields.mdc` (Find who stamps them).
- **Example:** none to cite; the central stamping code is the evidence.

### N8 — Access scope accepted but only partly applied
- **Signal:** a method takes allowed record IDs (for example the projects or regions a user may see) but applies only some of them, or materializes them only for an empty-list short-circuit. Also: `null` and empty treated alike. Also: a write that enforces the scope on some branches (single-row change, filtered bulk) but not on another, typically an unfiltered "all" branch that iterates every persisted row.
- **Verify:** L3. Restricted versus unrestricted fixture; for a write, one restricted fixture per branch with a persisted row outside the scope, asserting that row survives. L4 as a restricted user through `api-auth`.
- **Rule:** `{CURSOR}/skills/dotnet-ef-query-optimization/restrictions.md` (Restriction normalization pattern; `null` means unrestricted, empty means no access).
- **Example:** none to cite; use the rule's normalization pattern.

### N9 — Missing tenant predicate
- **Signal:** a tenant-owned table queried by child IDs alone, unless a global query filter (`HasQueryFilter`) applies the tenant and the query does not call `IgnoreQueryFilters()`. In SQL, a procedure or function that takes child IDs but no tenant parameter, or a view that joins tenant-owned tables on a natural key (code, name, title) without the tenant key in the join; SQL objects bypass EF global query filters.
- **Verify:** L1; L2 when claiming a cross-tenant leak (prove an ID set can cross tenants).
- **Rule:** `{CURSOR}/rules/dotnet-repositories.mdc`.
- **Example:** `GetWidgetsAsync(tenantId, widgetIds)` filtering on both.

### N10 — Write that can reach published or foreign rows
- **Signal:** an update keyed only on (tenant, parent, child), with no state predicate (draft, unpublished, owned by this aggregate), on a table that also holds live data.
- **Verify:** L2 by counting rows the predicate matches outside the intended state.
- **Rule:** `{CURSOR}/rules/dotnet-repositories.mdc`, `{CURSOR}/skills/dotnet-data-access/writes.md`.
- **Example:** none to cite; use the rule.

### N14 — Culture-dependent parsing or formatting
- **Signal:** `decimal.TryParse`, `double.Parse`, or `ToString("N")` on API input or export output without a culture. .NET uses the current culture unless given one.
- **Verify:** L3. A test under `de-DE` culture.
- **Rule:** none canonical; cite the example.
- **Example:** `int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var number)`.

### N16 — Revalidation that misses source-value changes
- **Signal:** an optimistic-concurrency or "is still current" check that compares only some of the inputs the protected operation consumes.
- **Verify:** L1 by listing every input the operation reads against what the check compares; L3 for a changed-input test.
- **Rule:** none canonical; cite the operation's own inputs as evidence.
- **Example:** none to cite.

### N17 — Ready or complete flags defaulting to `true`
- **Signal:** a DTO boolean meaning ready, complete, or has-values initialized to `true`.
- **Verify:** L1.
- **Rule:** `{CURSOR}/rules/dotnet-project-integrity.mdc`.
- **Example:** none to cite; use the rule.

### N19 — Side effect gated on part of a mixed change set
- **Signal:** a flag that gates a side effect (clearing defaults, resetting state, deleting dependents) is computed from one list of a change set, such as `deletes.Count == current.Count`, when the same request can also add or update rows. The gate describes the deletes, not the state the request ends in.
- **Verify:** L3. Send a mixed change set that removes every existing row and adds one, and assert that the side effect matches the end state. Before rating severity, check whether the current caller can send a mixed set.
- **Rule:** none canonical; cite the operation's own end state as evidence.
- **Example:** none to cite.

### N23 — Tenant or user identity taken from the request
- **Signal:** a controller action or service that takes a tenant ID, user ID or owner ID from the route, query, or body and passes it into a read or write instead of the authenticated caller's identity (claims on `HttpContext.User`, or the codebase's current-user service). Also: a body DTO whose `TenantId` is used without being overwritten or compared to the caller's. Also: a record loaded by ID and returned or mutated without a predicate that ties it to the caller's tenant (see N9 for the repository side). Not this hunt when the action's authorization restricts it to callers allowed to act across tenants; name that restriction in the evidence.
- **Verify:** L1 by tracing the ID from the action signature to the query predicate. L4 with `{CURSOR}/skills/api-auth/SKILL.md`: as a user of tenant A, request an ID owned by tenant B and show the response. L2 to find such an ID.
- **Rule:** `{CURSOR}/rules/dotnet-controller-conventions.mdc` (Tenant and user identity), `{CURSOR}/rules/dotnet-repositories.mdc`.
- **Example:** an action that passes the caller's tenant from the identity to every service call; a `Patch` that returns `BadRequest` or `Forbid` when `dto.TenantId` differs from the caller's.
- **Note:** a cross-tenant read or write is a security finding. Rate it by reachability, not by how much data is exposed.

### N24 — Missing or weaker authorization on a new action
- **Signal:** a new controller, or a new action on an existing one, with no authorization attribute (`[Authorize]`, a policy, or the codebase's own attribute) at class or method level, unless a global filter or fallback policy covers it; an action that requires fewer permissions than sibling actions over the same data (for example a write guarded only by the read permission); `[AllowAnonymous]` outside authentication flows; permission checks written inline in the action body where the codebase uses attributes or policies.
- **Verify:** L1 by listing the attribute on every changed action next to its siblings, and the global authorization setup (`AuthorizeFilter`, `FallbackPolicy`) at startup. L4 with a user who lacks the permission, through `api-auth`.
- **Rule:** `{CURSOR}/rules/dotnet-controller-conventions.mdc` (Authorization).
- **Example:** a class-level `[Authorize(Policy = "Widgets.Read")]` with a stricter policy on the write actions.

### N25 — Unbounded list endpoint
- **Signal:** a new or changed endpoint that returns every row for a tenant or user (orders, records, history) with no paging, `Take`, or documented cap, where the row count grows with data size.
- **Verify:** L2. Count the rows the endpoint would return for the largest tenant in the local database, and state the tenant. L4 with `{CURSOR}/skills/dotnet-endpoint-profiling/SKILL.md` for payload size and duration.
- **Rule:** `{CURSOR}/skills/server-side-pagination/SKILL.md`.
- **Example:** a list action that takes paging parameters and applies `Skip`/`Take` over a stable order.
- **Note:** a bounded lookup (enums, settings, a short reference list) is not this hunt. Say why the set grows before reporting it.

### N26 — Aggregate lock that not every writer takes
- **Signal:** a mutation serializes on an aggregate lock (`sp_getapplock`, `UPDLOCK`, a `Serializable` transaction, a lock factory) while another path that writes or publishes the same aggregate does not take it, or the mutation checks status (draft, unpublished) before acquiring the lock.
- **Verify:** L1 by listing every writer of the aggregate and where each takes the lock relative to its status check; L3 by running the publish between the mutation's status check and its commit, and asserting that the mutation fails or the publication sees its result.
- **Rule:** none canonical; cite the writers' lock acquisition and status checks as evidence.
- **Example:** one lock acquired per aggregate key (`AcquireAsync(tenantId, widgetId)`) by every service that writes the aggregate, before its status check.
