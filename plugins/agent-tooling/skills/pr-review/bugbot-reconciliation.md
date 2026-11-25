# pr-review — review-bot reconciliation

## Fetch

Fetch unresolved threads for the PR under review only. Run this outside the sandbox, because `api.github.com` needs full network access.

```bash
gh api graphql -F owner=<owner> -F name=<repo> -F number=<n> -f query='query($owner: String!, $name: String!, $number: Int!) { repository(owner: $owner, name: $name) { pullRequest(number: $number) { reviewThreads(first: 100) { nodes { isResolved isOutdated path line originalLine comments(first: 10) { nodes { author { __typename login } url body } } } } } } }' --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved | not)'
```

Skip resolved threads; their decision was already made. Keep only the threads whose first comment's author has `__typename` `Bot`. GraphQL reports a bot's login without the `[bot]` suffix that REST and the GitHub UI show: `cursor[bot]` (Cursor Bugbot) is `cursor`.

## Classify

Classify each unresolved thread against the code at the head SHA. For an outdated thread, judge the code, not the original line number. Each thread gets exactly one classification:

- `matched`: an independent finding covers the same defect. Link its `PCR-` ID.
- `confirmed`: a real defect the independent review missed. Add a new `PCR-` finding with the full verification ladder and severity cap, and add `- Source: <bot login> <thread url>` to it. Ignore the bot's own severity label.
- `rejected`: not a defect at the head SHA. Give the evidence in one or two sentences. When a rejection depends on generated SQL or schema behavior, cite the evidence that settles it:
  - Translation claims, such as parameter limits or `IN` versus `OPENJSON`: executed command text from EF command logging, or `ToQueryString` against a context configured like the application's (SQL Server provider and its options).
  - Referential-action or compatibility claims: the schema source at `<integration>` (table definitions, or the migrations and model snapshot, and the compatibility level the repository sets), not the local database.
  - A rejection argued from package versions and configuration alone is L1; say so.
- `superseded`: later commits removed the condition. Cite the line that changed.
- `needs author decision`: the code does what the thread says, but whether that is intended is a product question. Attach the data that bears on it, usually an L2 reachability count, and add the question to Questions for the Author.

## Report

With no unresolved review-bot threads, the Review-Bot Reconciliation section contains `None.` and the metadata line reads `Review bots: 0 unresolved threads`. The metadata counts must equal the table rows.
