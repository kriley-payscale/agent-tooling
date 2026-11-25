# agent-tooling

A Cursor plugin of rules, skills and agents for codebases built with Angular (and NgRx, Nx and Kendo UI where a repository uses them), ASP.NET Core with EF Core, and SQL Server, plus Tilt-based local environments. It works with sibling repositories, a monorepo or a single repository.

## Layout

```text
plugins/agent-tooling/       the plugin: rules, skills, agents, the setup command and scripts
proposals/                   proposed guidance changes and their outcomes
.github/workflows/check.yml  CI
```

## Where to start

| To | Read |
|---|---|
| See what the plugin holds, how the workspace and roles work, and fix setup problems | [Plugin README](plugins/agent-tooling/README.md) |
| Install it | [INSTALL-LOCAL](plugins/agent-tooling/INSTALL-LOCAL.md) |
| Plan and build changes, review and open PRs, and verify in a browser | [USAGE](plugins/agent-tooling/USAGE.md) |
| Write or change guidance or scripts | [CONTRIBUTING](CONTRIBUTING.md) |
| Propose a guidance change | [Tooling proposals](proposals/README.md) |

## Checks

Every pull request to `main` runs two checks on Ubuntu and Windows with Node 22:

```bash
node plugins/agent-tooling/scripts/check-guidance.mjs
node --test "plugins/agent-tooling/**/*.test.mjs"
```

In rules, skills, agents and commands, the guidance checker covers frontmatter, skill shims, guidance maps, path tokens, `{CURSOR}/…` references, relative links and a 12 KB size budget per file (a file already over it can shrink but not grow). It also validates the plugin's JSON files and the pending proposals. The tests cover the plugin's scripts. Run both before pushing; [CONTRIBUTING](CONTRIBUTING.md#checks) has the details.
