# Using agent-tooling

How to get work done with the plugin in Cursor on Windows or macOS. Install it first: [INSTALL-LOCAL](INSTALL-LOCAL.md).

`~` is your user profile: `C:\Users\<you>` (`%USERPROFILE%`) on Windows, `/Users/<you>` on macOS.

## How guidance loads

You rarely name a rule or skill.

- **Open the workspace.** Open Cursor through `<workspace root>/.cursor/agent-tooling/agent-tooling.code-workspace`; the plugin loads nowhere else.
- **Always on:** rule `path-token-resolver` resolves path tokens such as `{DOTNET}` from the runtime snapshot, and rule `environment-resolver` translates shell syntax for PowerShell and supplies the tool paths setup found.
- **By description:** every other rule attaches when your request matches its description.
- **Skills** are reached through the shims in `rules/skill-shims/`, whose descriptions carry each skill's trigger, or by name: type `/<skill-name>` in Agent chat, for example `/pr-review`. Skill `client-angular-component` has no shim; rule `client-component-conventions` sends the agent to it.
- **Agents** under `agents/` are dispatched by the plan workflow; you don't start them yourself.
- **Be specific.** Name the layer and the action. "Add a nullable column to a table and map it on the EF Core entity" loads the SQL and entity guidance; "add the backend for X" loads little.
- **Generated files** (plans, reviews, evidence) go under `{ARTIFACTS}`, the `agent-tooling` folder in the workspace.

The plugin has one command, `/agent-tooling-setup`. It records roles on the first run and warns on every run about an unset role that several folders could hold, refreshes tool paths, and writes the workspace file when it's missing ([First run and later runs](README.md#first-run-and-later-runs), [Tools](README.md#tools)).

## Workflows you start

| Goal | Ask | You get | Needs |
|---|---|---|---|
| Set up or refresh the workspace | `/agent-tooling-setup` | Roles and tool paths in the configuration, and the workspace file | Nothing extra |
| Plan and build a change | Ask for discovery and a plan; see [Planned work](#planned-work) | Discovery, an approved plan, a commit per task, verification evidence | Depends on the plan; see [Requirements](#requirements) |
| Open a PR | `/pull-request` | The branch pushed and a PR filled from the repository's template | `gh` signed in |
| Review a PR | `/pr-review <PR URLs>` | One review file per session under `{ARTIFACTS}/code-review/` | `gh` signed in; more checks with your local environment running ([Reviewing a PR](#reviewing-a-pr)) |
| Call the local API | "Log in to the local API and call GET /api/widgets" | Authenticated responses through skill `api-auth` | [Credentials file](#credentials-file); `curl` (`curl.exe` is built into Windows 10 and later) |
| Query the local database | "Query the local database for <question>" | Results through skill `sql-query` | `sqlcmd`; [local SQL Server](#local-sql-server) |
| Propose a guidance change | Follow [tooling proposals](../../proposals/README.md) | A proposals PR | `gh` signed in |

## Planned work

Planned work runs in stages, each ending where you review and choose what happens next. Any Agent chat works; plan mode isn't needed.

1. **Brief (optional).** Ask "create a discovery prompt for <ticket or idea>". Skill `create-discovery-prompt` reads the ticket, pages or files you point to and returns a brief in chat. It doesn't research code. Paste the brief into a new chat.
2. **Discovery.** Ask for discovery and a plan, with the brief or your own description. Skill `discovery` researches the affected roles, writes the handoff and user flows, and proposes feature branches.
   **You review** the requirements, user flows (`UF-001`, …) and branch map, then choose: plan, revise discovery or stop.
3. **Planning.** Skill `create-plan` writes the plan (Decisions, Escalation boundary, tasks) and one file per task; the last task is end-to-end verification. Readiness checks confirm credentials, fixtures and verification commands before Build. For a large design it may delegate a draft to [planning-agent](agents/planning-agent.md); the final plan is still the parent's.
   **You review** and approve the plan. Its Decisions record the approved branches and the approval for task commits.
4. **Build.** Ask the agent to build the plan. Skill `implement-plan` makes the chat the Lead: it dispatches each task to the implementation agent for its role (`implementation-client-agent`, `implementation-dotnet-agent`, `implementation-sql-agent`), verifies the task and commits it on the approved feature branch. It never pushes. The plan stays unchanged while Build runs. If Build stops, ask it to resume; progress is kept in `execution-state.md`.
5. **Final verification.** The last task runs the planned end-to-end checks. When the plan opts in, browser flows run through [verification-agent](agents/verification-agent.md) ([Browser verification](#browser-verification)). The completion summary lists any tooling friction the workers reported.

Artifacts for a run:

```text
{ARTIFACTS}/planning/<plan-slug>/
  discovery/discovery.md         discovery handoff
  discovery/user-flows.md        user flows with stable UF IDs
  <plan-slug>.plan.md            the plan
  tasks/NN-task-<plan-slug>.md   one file per task
  verification/                  final-verification evidence
  execution-state.md             Build progress
```

## Reviewing a PR

`/pr-review` reviews GitHub PRs that change your client, .NET or SQL code, whoever wrote them. It reports only defects it can show evidence for, and rates each no higher than that evidence supports. It never edits code, pushes, comments on GitHub or writes to the database, and it asks before an API call that would write data. It works in temporary worktrees, so your branches and uncommitted work are untouched. Procedure: [pr-review](skills/pr-review/SKILL.md).

- **Give every PR of a change in one message.** PRs in different repositories are checked against each other's contracts.
- **Start a new chat and add no context.** The review judges the code on its own evidence. It reads the PR title, body and linked issue only for intent, and ignores plans, design documents and earlier reviews.
- **Narrow it when you need to:** pin a head SHA, or limit the review to paths.
- **Ask for a readability pass** if you want one. It's off by default and reported separately from correctness findings.

The more of your environment is running, the more findings the review can confirm or rule out instead of leaving as open concerns. Anything it couldn't run is listed under Review Limitations with the check that would settle it.

| For | Have ready |
|---|---|
| Any review | `gh` signed in |
| Tests | `dotnet` for .NET; `node_modules` installed in your main checkout of the Angular workspace |
| Data checks | A local SQL Server and `sqlcmd`; queries are read-only |
| API checks | Your local environment running, the [credentials file](#credentials-file), and your main checkout on the PR's head commit |
| Layout checks | Everything API checks need, plus [Playwright MCP](#browser-verification) |

A session writes one file, `{ARTIFACTS}/code-review/<repo>/<PR>/review-<timestamp>.md`, and returns one line per PR in chat. You decide what reaches the PR. When you comment, state the convention in plain words and point to code or data; reviewers who don't use the plugin can't follow a reference to a rule file. To review again after changes, run the command again; each session writes a new file.

## Opening a PR

`/pull-request` starts from a feature branch with a clean working tree. It pushes the branch, fills every heading of the repository's PR template and opens the PR with `gh`. A change that spans repositories gets one PR per repository, linked to each other. It never force-pushes without asking.

## Browser verification

[verification-agent](agents/verification-agent.md) runs approved user flows in a browser through Playwright MCP. A plan opts in with a `Browser verification: verification-agent` section in its final task, and `/pr-review` uses the `playwright` server below for layout checks. Procedure: [final verification](skills/implement-plan/final-verification.md) and [browser reference](skills/implement-plan/browser-verification.md).

**Prerequisites:** Node.js 20 or newer (for `npx`) and Google Chrome.

**Setup:** add these two servers to `mcpServers` in `~/.cursor/mcp.json`, keeping your existing servers. Replace `{ARTIFACTS}` with `paths.ARTIFACTS` from the runtime snapshot, and `data-testid` with the attribute your templates use for test ids. Leave `${userHome}` as written; Cursor expands it to your user profile.

On Windows, change two things in each server:

- Use `"command": "npx.cmd"`. On Windows `npx` is a `.cmd` file, which Cursor can't start by its bare name.
- Write the `{ARTIFACTS}` path with forward slashes, for example `C:/src/acme/.cursor/agent-tooling/playwright/slot-1`. A single backslash breaks the JSON.

```json
{
  "playwright": {
    "type": "stdio",
    "command": "npx",
    "args": [
      "-y", "@playwright/mcp@0.0.83",
      "--browser", "chrome",
      "--isolated",
      "--test-id-attribute", "data-testid",
      "--output-dir", "{ARTIFACTS}/playwright/slot-1",
      "--secrets", "${userHome}/.agent-tooling/credentials"
    ]
  },
  "playwright-verifier-2": {
    "type": "stdio",
    "command": "npx",
    "args": [
      "-y", "@playwright/mcp@0.0.83",
      "--browser", "chrome",
      "--isolated",
      "--test-id-attribute", "data-testid",
      "--output-dir", "{ARTIFACTS}/playwright/slot-2",
      "--secrets", "${userHome}/.agent-tooling/credentials"
    ]
  }
}
```

After changing `mcp.json`, reload Cursor and start a new chat.

- **Server names.** Slot 1 is `playwright` and slot 2 is `playwright-verifier-2`. Other names leave the verifier without a browser.
- **Isolation.** `--isolated` gives each server its own browser. Don't add `--shared-browser-context` or `--save-session`, or share a browser profile.
- **Credentials.** `--secrets` loads `~/.agent-tooling/credentials`. The verifier types key names such as `STANDARD_PASSWORD` into login fields and the server fills in the values, so passwords never appear in tool calls. Never put credential values in `mcp.json`.
- **Evidence.** `--output-dir` keeps screenshots and traces under `{ARTIFACTS}/playwright/`.
- **Version.** `@playwright/mcp` is pinned; upgrade it only together with a check of the verifier.
- **One verifier by default.** Running two at once (slot 2) needs demonstrated browser isolation first; see the [browser reference](skills/implement-plan/browser-verification.md).

Or ask an agent, in a new Agent chat in the workspace:

```text
Set up Playwright MCP following the "Browser verification" section of {CURSOR}/USAGE.md, using ARTIFACTS from AGENT_TOOLING_RUNTIME and the test-id attribute this codebase's templates use. Back up ~/.cursor/mcp.json, then merge in the two servers without changing existing ones, applying the Windows changes if this is Windows. Never put credential values in mcp.json. Show me the diff, then tell me to reload Cursor and start a new chat.
```

## Calling the local API

Skill `api-auth` logs in to your running local API and makes authenticated calls. The agent finds your API's login endpoint and writes the login body with placeholders such as `${ADMIN_PASSWORD}`. The skill's helper fills them from an environment variable of the same name or else the credentials file, keeps a session for each actor in `~/.agent-tooling/sessions/` (a cookie jar, or a bearer token when the login returns one), and prints the response body with the HTTP status as its last line. Login output has token, secret and password values redacted, so credentials never appear in commands or output. A login that needs an antiforgery token, a second factor or a non-JSON body is beyond the helper; the agent reports those checks as not run. Procedure: [api-auth](skills/api-auth/SKILL.md).

## Credentials file

`~/.agent-tooling/credentials` (on Windows `%USERPROFILE%\.agent-tooling\credentials`, with no file extension) holds the values skills need at run time, one `KEY='value'` per line, dotenv style. The keys are in [credentials.example](skills/api-auth/scripts/credentials.example):

| Key | Used for |
|---|---|
| `API_BASE_URL` | The base URL of your locally running API |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | A user with the admin role |
| `STANDARD_EMAIL`, `STANDARD_PASSWORD` | A user without admin rights, for permission checks |
| `SQL_PASSWORD` | The password of the local SQL Server login the SQL skills use |

- **Create it** from `credentials.example` and replace every `replace-with-` value. [Credential setup](skills/api-auth/credential-setup.md) has the commands for bash and PowerShell, and the agent runs them during planning when a plan needs credentials.
- **Values stay out of chat.** Skills load values when a command runs and never print them; Playwright MCP gets key names, not values. Don't paste credentials into chat.
- **Format.** Several readers parse the file: the API helper, Playwright's `--secrets` loader and `node --env-file`. Single-quote values and use no backslash escapes; leave a value that contains `'` unquoted. An environment variable with the same name overrides the file for the API helper and `node --env-file`.
- **Permissions.** On macOS, run `chmod 600 ~/.agent-tooling/credentials`. On Windows, a file under your profile inherits the profile's permissions, which other standard users can't read.
- **On Windows**, create and edit it in a code editor, not Notepad, which can add a `.txt` extension.
- **Never commit it.**

## Local SQL Server

The SQL skills take the server, database and login from your application's local connection string, and the password from `SQL_PASSWORD`, loaded when the command runs. When the login fails, the agent stops and asks for your server and authentication method rather than guessing. A server that uses Windows authentication needs no password.

## Requirements

| Dependency | Needed by | Required? |
|---|---|---|
| [Playwright MCP](#browser-verification) | Plan browser verification; `pr-review` layout checks | When a plan's final task has a browser verification section. Without it, a review records layout checks as not run. |
| [Credentials file](#credentials-file) | Local API calls, browser login, SQL queries | For authenticated API, browser or database checks |
| `gh`, signed in | `pr-review`, `pull-request`, submitting proposals | For reviews, opening PRs and submitting proposals |
| Local tools (`dotnet`, `sqlcmd`, `rg`) | Builds and tests, SQL queries, code search | Per workflow; `/agent-tooling-setup` reports what's missing |
| [A local SQL Server](#local-sql-server) | SQL queries; data checks in reviews and plans | Per workflow |
| An issue-tracker MCP server, such as Atlassian's | Reading the tickets and pages you reference | No; skills work from links and files you provide |

## When the guidance is wrong

Submit a [tooling proposal](../../proposals/README.md).
