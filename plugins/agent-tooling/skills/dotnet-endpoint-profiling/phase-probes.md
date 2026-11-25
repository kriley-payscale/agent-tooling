# In-code phase probes

Probes are temporary. They are not product telemetry. Add them at the start of an iteration; strip them before the optimization ships. Reverting the logging toggle is not teardown by itself.

**Add**

- Service orchestration: wrap named awaits in a temporary `TimePhaseAsync` / `LogPhase` helper with `LogInformation` and a stable template (`phase`, `elapsedMilliseconds`, `itemCount`, and the id of the entity the request works on).
- A local `Stopwatch` only for a loop that is not a single await.
- `.TagWith("<workflow> <query name>")` on EF queries you need to find in Command logs. Prefer TagWith plus the EF log over a second repository `Stopwatch` / `LogDebug` when the service already times the call.

**Do not**

- Add `[assembly: InternalsVisibleTo("<TestProject>")]` to a production project to pin a private selection query.
- Leave optimization-changelog comments (BulkInsert identities, round-trip counts, omitted joins).

**Teardown** (required before claiming done)

- Unwrap `TimePhaseAsync` to direct awaits.
- Delete `LogPhase`, probe `Stopwatch`s, `.TagWith`, and any `ILogger` added only for timing.
- Keep operational outcome logs.
- Keep comments that encode a trap the next edit will violate.
