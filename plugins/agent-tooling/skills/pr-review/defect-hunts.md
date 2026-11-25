# pr-review — defect hunts

Run every hunt in the hunt file for each layer the PR touches, as the Guidance map in [SKILL.md](SKILL.md) selects them. A .NET change usually needs both .NET files.

- Run the hunts in [defect-hunts-cross-repo.md](defect-hunts-cross-repo.md) when the PR changes or consumes a contract that another layer owns or uses: DTOs, endpoints, enums, permissions, flags, error bodies, table shape.
- Run X7 in that file whenever the PR adds or changes a query predicate, join, or order key, even with no contract change.
- For a change to a SQL view, procedure or function, also run N1, N2 and N20 in [defect-hunts-dotnet-queries.md](defect-hunts-dotnet-queries.md) and N9 in [defect-hunts-dotnet-service.md](defect-hunts-dotnet-service.md).
- Legacy parity: when the change replaces a stored procedure, view, or legacy flow, find the predecessor at `<integration>` and compare grain, inner versus left joins, tie-breaks, and filters. A divergence is a finding only when the PR's behavior is wrong, not merely different.

A hunt is a question to answer from the code; it is not a finding until the verification ladder in `SKILL.md` supports it.

Each entry gives:

- **Signal:** what to look for in the diff and its callers.
- **Verify:** the lowest ladder level that can settle it, and the command shape.
- **Rule:** the canonical rule or skill that governs it.
- **Example:** the shape of compliant code. Cite the repository's own instance on `<integration>` as `path` + symbol, found with `git grep` and checked under "L1 pattern" in [verification.md](verification.md); when there is none, cite the rule alone.
