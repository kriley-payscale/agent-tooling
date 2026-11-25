---
name: dotnet-endpoint-profiling
description: Measure API request latency before/after an optimization against the local API that api-auth reached. Use when capturing a baseline, attributing wall time to SQL vs .NET, enabling EF Core command logging, comparing warm endpoint timings, diagnosing a large wall-minus-logged-SQL residual, or adding and removing in-code phase probes. Use tilt logs only when Tilt owns the API.
disable-model-invocation: true
---

# Profile the local API endpoint

Profile whichever local API the `api-auth` login reached.

## Guidance map

| When | Read |
|---|---|
| Attributing read cost, explaining a large wall-minus-logged-SQL residual, or attributing one request without changing log levels | [plan-cache.md](plan-cache.md) |
| Producing the before arm of a comparison, or an after arm separates from a baseline captured before implementation | [baseline-arm.md](baseline-arm.md) |
| Adding in-code timing probes, or finishing an iteration that added them | [phase-probes.md](phase-probes.md) |
| Authenticating the request under test | skill `api-auth` |
| Checking pod readiness when Tilt owns the API | rule `tilt-dotnet-readiness` |
| Plan-cache and procedure DMVs | skill `sql-query` |

## Find the API process and its logs

When the host process owns the API (`dotnet run`, an IDE), read that process's output instead of `tilt logs`. When Tilt owns it, discover the names instead of assuming them:

- `tilt get uiresources` lists the resources: the API workload, and any local resource that runs `dotnet publish`.
- The Tiltfile under `{TILT}`, and the files it loads, show which resource publishes, which files it ignores, and the Kubernetes manifests or Helm chart it deploys.
- `kubectl get pods -A`, or those manifests, give the API's namespace and pod.

## Persist the capture before the request

When Tilt owns the API, `tilt logs` is a small rolling buffer, not a log store. A baseline left in it will be gone within a few requests.

Once `Microsoft.EntityFrameworkCore.Database.Command` is at `Information`, a single large request emits tens of thousands of lines and evicts the start of its own trace from the container ring buffer before the request finishes. Persisting afterwards is not sufficient. Start a follower **before** the request:

```bash
kubectl logs -f <pod> -n <namespace> --since=1s > /tmp/<label>.txt
```

Run it as its own durable background process — in Cursor, a `Shell` call with `block_until_ms: 0`, not `nohup ... &` inside a call that returns. Backgrounding with `&` inside a single invocation looks like it worked and silently produces a near-empty file. `--tail=<huge>` does not recover evicted lines.

After the request, assert the captured line count **and** that the file contains the first expected marker line you chose, not just the last.

## Enable EF SQL logging

Raise `Microsoft.EntityFrameworkCore.Database.Command` to `Information` where the API sets log levels: a Serilog `MinimumLevel:Override` section, in `appsettings*.json` or a separate Serilog file the host loads, or `Logging:LogLevel` for the built-in logger. Search the API project's JSON files for `MinimumLevel` and `LogLevel` to find it. Revert it before finishing — the toggle must not be committed. Reverting it is not teardown by itself: when finishing an iteration that added in-code timing probes, remove them per [phase-probes.md](phase-probes.md).

When Tilt owns the API, check whether the edit reaches the running process. If the publish resource ignores that file, or the app reads it only at startup, saving the override neither republishes nor reaches the running process. Then, after editing the file, run `tilt trigger <publish resource>`, wait for the publish to finish and for a `Now listening` newer than the last shutdown, and confirm the override inside the pod before starting the log follower:

```bash
kubectl -n <namespace> exec <pod> -- grep -c "Database.Command" <the file's path in the container>
```

The revert needs the same trigger and the same in-pod check (grep count 0). Reverting the source file alone leaves the pod logging every command until the next unrelated publish. "Wait for the publish to settle" with no trigger waits on a publish that never starts.

## Isolate the request under test

Start the log follower after any setup/arrange calls settle, and slice the file from that offset. Setup traffic attributed to the request under test is a false SQL profile.

## Warm runs

Discard the first request after a publish or pod restart. JIT and EF query-plan compilation land outside any phase instrumentation, so a cold capture shows inflated wall time with nothing to attribute it to. The tell is a wall-clock figure that materially exceeds the sum of the instrumented work. The penalty belongs to the **first request of the process**, whatever it is — a deliberate throwaway request is a valid way to reach a warm state.

A before/after claim must come from an **A/B in the same session** ([baseline-arm.md](baseline-arm.md) covers producing the before arm, and what to do when an after arm separates from a baseline captured before implementation): both arms under the same machine load. A baseline captured earlier in the day is not a valid comparison arm. On a shared workstation the run-to-run spread is routinely ±0.5 s, so a median of three can move further than the change being measured. Report median with min and max from enough samples (nine is a workable default) so the reader can see whether the two distributions actually separate. When they overlap heavily, say so rather than quoting the median difference as the result.

Time inside the loop around the authenticated call (`node -e "console.log(Date.now()/1000)"` before and after), not `/usr/bin/time` around the auth helper. The wrapper form reports hundredths of a second for a request that takes over a second, and the reading is plausible enough to be believed. Capture the response's own total-count or row-count field in the same iteration so every timed run is also a correctness check against the pre-change baseline.

## Attribute cost

Parse `Executed DbCommand (Nms)` into command count, total logged SQL ms, and a per-`(operation, table)` breakdown. That table identifies the bottleneck, not the wall clock.

**EF logs time-to-first-row, not total execution.** A query that streams its first row quickly and then grinds is almost entirely invisible. A large wall-minus-logged-SQL residual is therefore not evidence of in-process C# cost, and must not be reported as one.

**Reads:** derive true per-execution cost from the plan cache after the request under test, as [plan-cache.md](plan-cache.md) describes. Do not rebuild an EF-emitted statement's parameters by hand.

**Writes:** `Executed DbCommand` duration is trustworthy because writes do not stream rows back.

**`SqlBulkCopy` emits no `Executed DbCommand` at all.** Qualify BulkInsert by identity output. `BulkInsert` with `SetOutputIdentity = true` is not silent: EFCore.BulkExtensions stages a temp table and runs `MERGE … OUTPUT` so identity values come back; those commands still appear as `Executed DbCommand`. `BulkInsert` without identity output uses `SqlBulkCopy` and vanishes from the EF log. After inserting parents with identity output and children without, expect a MERGE for the parents and nothing for the children. Absence of child insert commands is not data loss — after converting a write to silent `BulkInsert` the capture will show the insert has vanished rather than shrunk. Verify child row counts and audit stamps in SQL before claiming the change worked.

When attributing a silent bulk copy, poll `sys.dm_exec_requests` on the API session and read consecutive `BULK INSERT` samples as a series, not as one snapshot. If `cpu_time` / `total_elapsed_time` reset between samples, those are separate commands (library default batching). If the counters increase, it is one copy. Empty `wait_type` with `status = running` is CPU executing — not evidence the cost is in-process C#, and not `WRITELOG` ownership. Do not treat the last sample's 10 ms `cpu_time` as the whole insert.
