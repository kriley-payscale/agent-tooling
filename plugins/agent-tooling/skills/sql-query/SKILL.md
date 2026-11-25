---
name: sql-query
description: Run queries against the local development SQL Server using sqlcmd. Use when inspecting table data, verifying schema changes, running a script locally, checking active SQL requests, blocking, CPU, logical reads, index coverage, a slow or production-slow query, or missing-index evidence.
disable-model-invocation: true
---

# Query the Local SQL Server

## Guidance map

| When | Read |
|---|---|
| An API call returns 504 or a browser spinner hangs, a request may be blocked, or index coverage or two hand-written query shapes need SQL evidence | [perf-diagnostics.md](perf-diagnostics.md) |
| Finding a statement in the plan cache by its SQL text, or diffing two plan-cache snapshots | [plan-cache-filtering.md](plan-cache-filtering.md) |
| The statement under test is inside a stored procedure, a `#temp` table index is in question, or plan XML is dumped through `sqlcmd` | [procedure-profiling.md](procedure-profiling.md) |
| The fix is EF query shape, staging, pagination, projection width or access-list normalization | skill `dotnet-ef-query-optimization` |

## Connection details

Take the server, database and login from the application's local connection string: the API project's `appsettings.Development.json`, its user secrets (`dotnet user-secrets list --project <Api>.csproj`), or a `.env` file the local stack reads. Print only those parts, never a password: run this on the file, or pipe the secrets list into it:

```bash
rg -n -o -i '(server|data source|database|initial catalog|user id|uid|integrated security|trusted_connection)=[^;"]*' <file>
```

- **Password.** It is `SQL_PASSWORD` in `~/.agent-tooling/credentials`, loaded at run time as in the commands below. Never type or print its value, and never read the credentials file. If the connection string carries its own credential, or uses integrated security (`-E` in place of `-U` and `-P`), use that instead.
- **Server.** A containerized API names the server as the container sees it (`host.docker.internal`, a compose or cluster service name). From the host, use `localhost` and the published port.
- **Database.** Use the name from the connection string. A local copy is often named differently from the deployed database, and a wrong name fails or connects to the wrong database.
- **Login fails.** Stop and ask the user to check `SQL_PASSWORD` (it may be unset or still the template's placeholder), the server and the authentication method; do not guess. A Go `panic: runtime error: index out of range` from `sqlcmd` means `-P` received an empty value, usually because the credentials file is missing.

Use `sqlcmd` on `PATH`, or the path in `AGENT_TOOLING_RUNTIME.tools`. The Go-based Microsoft CLI treats `<` as the start of XML. A `<>` comparison in a `-i` or `-Q` script fails with `Msg 102 Incorrect syntax near '<'` before SQL Server sees the batch. Use `!=` in scripts this CLI will run.

Below and in this skill's leaves, `<connection>` stands for `-S <server> -d <database> -U <login> -P "$(node --env-file="$HOME/.agent-tooling/credentials" -p process.env.SQL_PASSWORD)" -C -b`.

## One-off query

```bash
sqlcmd -S <server> -d <database> -U <login> -P "$(node --env-file="$HOME/.agent-tooling/credentials" -p process.env.SQL_PASSWORD)" -C -b -Q "SELECT TOP 10 WidgetId, TenantId, Name FROM dbo.Widget"
```

The `-C` flag trusts the self-signed certificate. `-b` makes a failed batch exit non-zero; without it `sqlcmd` exits 0 after a SQL error. Always include both.

## Wide table tip

Select named columns. `SELECT *` on a wide table, especially one with `MAX` columns, produces unreadable output. List the table's columns first:

```bash
sqlcmd <connection> -Q "SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'Widget' ORDER BY ORDINAL_POSITION"
```
