# Login recovery

### If login returns status 000 or 502

Keep this recovery local and bounded:

1. Find what serves the base URL: a Tilt (or other local orchestrator) resource whose route matches it, or a process on the host.
2. **Tilt owns the route:** read `{CURSOR}/rules/tilt-dotnet-readiness.mdc` and wait for its endpoint-readiness conditions. A Ready pod and a service endpoint are not enough: the API's latest `Now listening on` line must be newer than its latest shutdown. Then retry the unchanged `login` command exactly once. Never start a host API while Tilt owns the route.
3. **The host owns the route:** check whether the API is already running (a `dotnet` process for the API project, or a listener on the base URL's port). If not, complete the build rule `dotnet-build-loops` prescribes, then start it from `{DOTNET}`:
   ```bash
   dotnet run --project <path to the API .csproj> --no-build
   ```
   Do not start another API process if one is already running.
4. Watch that same process's output for up to 60 seconds. Readiness requires it to report `Now listening on` or `Application started`. Do not poll by launching additional processes. If no readiness signal appears within 60 seconds, stop and report the latest startup error or output.
5. Only after the readiness signal, retry login once against the URL that process printed. Pass `--base-url <that URL>` to both `login` and `call`.

If API startup reports an unrelated failure, stop and report it. If the single login retry fails for any reason, classify its status using Step 2 in [SKILL.md](SKILL.md), report it, and stop. Never start another recovery loop. This recovery applies only to the local environment; never use it to start or troubleshoot a non-local target.

### If login returns HTTP 504

Right after an in-place API restart, the first login can exceed the ingress timeout while the process is still warming up. An nginx ingress returns 504 after about 60 seconds, and the API later logs the request completing with 200. Keep this recovery bounded:

1. Read the API log for that login request's completion line, such as ASP.NET Core's `Request finished ... POST <login path> ... - 200` or Serilog's `HTTP POST <login path> responded 200 in <ms>`. Use `tilt logs <resource>` when Tilt owns the route, or the host process output otherwise.
2. **The request completed, or the API does not log request completion:** retry the unchanged `login` command exactly once.
3. **The request did not complete:** follow the SQL diagnosis for API 504s in `{CURSOR}/skills/sql-query/perf-diagnostics.md` before any retry.

Do not change credentials, start another API, or restart Tilt because of one cold-start 504. If the single login retry fails for any reason, classify its status using Step 2 in [SKILL.md](SKILL.md), report it, and stop.
