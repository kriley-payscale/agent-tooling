---
name: api-auth
description: "Use when calling an authenticated endpoint of the locally running API: logging in from the credentials file, keeping a cookie or bearer-token session per actor, sending JSON or multipart requests, or preparing API credentials during planning for authenticated local verification."
disable-model-invocation: true
---

# Authenticated calls to the local API

`api.mjs` signs in to the locally running API and makes authenticated JSON or multipart requests, keeping one session per actor. It needs Node 20+ and `curl` on PATH (`curl.exe` on Windows 10+). The commands are the same in bash, zsh and PowerShell.

## Guidance map

| When | Read |
|---|---|
| The credentials file is missing or holds placeholder values, or planning must confirm credentials for authenticated verification | [credential-setup.md](credential-setup.md) |
| Login returns status 000, 502 or 504 | [login-recovery.md](login-recovery.md) |
| A shell command needs smart-mode approval, two actors must be signed in at once, or a request body goes through Windows PowerShell 5.1 | [advanced-calls.md](advanced-calls.md) |

## Step 1 — Find the base URL and the login request

- **Base URL.** Use the local route the dev environment exposes for the API (a Tilt or ingress host), or the address the host process printed (`Now listening on: ...`), which comes from `applicationUrl` in the API project's `Properties/launchSettings.json`. Set `API_BASE_URL` in `~/.agent-tooling/credentials`, or pass `--base-url URL` to every command.
- **Login request.** Find the login endpoint in the auth controller or endpoint mapping (search for `SignInAsync`, `Login`, `MapIdentityApi`) or in the OpenAPI document (often `/swagger/v1/swagger.json`). Note the path, the body's field names, and whether it sets a cookie or returns a token. ASP.NET Core Identity's `/login` returns a token unless called with `?useCookies=true`.
- Extra fields the endpoint requires, such as a development captcha bypass value, go in the template too. Put a secret one in the credentials file and reference it as a placeholder.
- A login that needs an antiforgery token, a second factor or a non-JSON body is outside what the helper does. Report the authenticated checks as not run and say why.

## Step 2 — Log in

```bash
node {CURSOR}/skills/api-auth/scripts/api.mjs login /api/auth/login '{"email":"${ADMIN_EMAIL}","password":"${ADMIN_PASSWORD}"}' --as admin
node {CURSOR}/skills/api-auth/scripts/api.mjs login /api/auth/login '{"email":"${STANDARD_EMAIL}","password":"${STANDARD_PASSWORD}"}' --as standard
```

- The path and field names are examples; use what Step 1 found.
- The helper fills each `${KEY}` from the environment, then `~/.agent-tooling/credentials`, JSON-escaped. A value still starting with `replace-with-` counts as unset, and the helper stops with an error naming the key. Never write a credential value into a command. Single-quote the template in every shell so the shell leaves `${...}` alone; `-` in place of the template reads it from stdin. When the template goes through Windows PowerShell 5.1, use the stdin form in [advanced-calls.md](advanced-calls.md).
- Each `--as` actor (default `default`) has its own session in `~/.agent-tooling/sessions/`: a cookie jar `<actor>.cookies`, which login starts fresh and deletes when the login fails (4xx, 5xx or no response; a 3xx after the cookie is set keeps it). When the endpoint returns a token instead of a cookie, add `--token FIELD` (a dotted path such as `data.accessToken` works, and `--token .` takes a body that is the token itself); the token goes to `<actor>.token`, and that actor's calls then send `Authorization: Bearer`.
- Login replaces that actor's session. When another session may be signed in as the same actor, use a task-unique `--as` name, such as `admin-<task>`.
- The output is the response body, with token, secret and password values redacted, then the HTTP status as the last line.

Read the status and body. Exit code 0 only means a response arrived:

- `2xx` with the user or token payload: signed in. A 200 can also carry a password-expired, first-login or second-factor payload, which is not a session.
- `400` or `401`: the body or the credentials were rejected. Check the template's field names against the endpoint before suspecting the credentials.
- `000`, `502` or `504`: nothing answered at the base URL, or the API or its proxy isn't ready. This is not evidence of bad credentials.

When login returns status 000, 502 or 504, open [login-recovery.md](login-recovery.md). When the credentials file is missing or holds placeholder values, open [credential-setup.md](credential-setup.md).

## Step 3 — Call an endpoint

```bash
node {CURSOR}/skills/api-auth/scripts/api.mjs call GET /api/widgets --as admin
node {CURSOR}/skills/api-auth/scripts/api.mjs call POST /api/widgets '{"name":"test"}' --as admin
echo '{"name":"test"}' | node {CURSOR}/skills/api-auth/scripts/api.mjs call POST /api/widgets - --as admin
node {CURSOR}/skills/api-auth/scripts/api.mjs call POST /api/widgets/import --form 'tenantId=8' --form 'file=@/absolute/path/input.xlsx;filename=input.xlsx;type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' --as admin
node {CURSOR}/skills/api-auth/scripts/api.mjs call DELETE /api/widgets/123 --as admin
```

- Use `call` for every authenticated request, never raw curl. It sends and updates the actor's cookie jar, sends its bearer token, passes `-k` and `Accept: application/json`, and appends the status line. It stops with an error when the actor has no session: it never logged in, or its last login failed.
- The last line is the status; everything before the final newline is the body.
- For multipart, repeat `--form FIELD=VALUE` once per field; curl sets the boundary. `--form` cannot be combined with a JSON body.
- The positional body is fine on macOS, Linux and PowerShell 7.3+. When a request body goes through Windows PowerShell 5.1, use the stdin form in [advanced-calls.md](advanced-calls.md).

### File downloads are not supported

`call` is for JSON and multipart requests. It sends `Accept: application/json`, writes the response to stdout with the status line appended, and has no output-file option, so it cannot save a binary body intact. Do not redirect its stdout into a file and treat that file as the download, and do not fall back to raw curl. Report any live check that depends on downloaded file content, and any later check that needs that file as input, as not run, and name the endpoint.

## Step 4 — Read the response

- `2xx` with the expected payload: the endpoint works.
- `401`: no authenticated session reached the API: the session expired, its login failed, or the call used another `--as`. A 401 is not a permission gap; do not start a permission search from it. Log in again once. If the 401 persists after a 2xx login, check that the session can reach the API before blaming the user: a token login needs `--token`, and a cookie login needs its auth cookie in the actor's jar for the base URL's host (read only columns 1, 4 and 6 of the jar's tab-separated lines: domain, secure flag and name, never the value in column 7; an HttpOnly cookie's line starts with `#HttpOnly_`, so do not skip it as a comment). curl drops a `Secure` cookie over plain `http` except on localhost. Only when the session is sent and still refused, report the user as blocked or pick another.
- `403`: authenticated but refused. An empty 403 does not say whether an authorization policy or filter refused or the service layer did. Read the API log for that request before concluding the account lacks a permission. If the log shows the request reached the service layer, the policy passed and a service check refused it, often record ownership; act as the record's owner instead of searching permissions.
- `500`: server error; read the API log or console output.

## Acting as a planned actor

Sign in as a user who has the planned role, one `--as` actor per user. If the app has an impersonation feature, log an admin in under a new actor name and call the impersonation endpoint with that `--as`; that actor's later calls act as the impersonated user.

Confirm the switch before any permission check: call the app's current-user endpoint as that actor and compare user and tenant with the planned actor. `call` does not follow redirects, so a 3xx from the impersonation call is not proof by itself.

## Notes

- `-k` skips TLS verification, because a development certificate the OS trusts may still be rejected inside an agent sandbox. Use the helper, these credentials and `-k` only against the local environment.
- In a multi-tenant app, record in the credentials file's comments which tenant each pair belongs to, and pick the pair whose tenant owns the data under test.
- The browser session (Playwright) does not share these cookie jars.
