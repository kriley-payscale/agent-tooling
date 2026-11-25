---
name: unit-test-guidance
description: "Use when planning, adding, changing, removing or reviewing unit tests: .NET test projects (NUnit, NSubstitute, EF Core fixtures) or Angular *.spec.ts files (Jest, TestBed, NgRx, Kendo), or deciding whether a behavior change needs a test."
disable-model-invocation: true
---

# Unit test guidance

A test earns its place by failing when behavior someone depends on breaks. Test count, line coverage and one test per branch are not goals.

The map's conditions describe the test being written.

## Guidance map

| When | Read |
|---|---|
| Any .NET test | [dotnet-conventions.md](dotnet-conventions.md) |
| `Received` on sync or async members, `Received.InOrder`, null branches, optional-parameter stubs, `Arg.Is`, async failures | [dotnet-nsubstitute.md](dotnet-nsubstitute.md) |
| The SUT is a repository or query class on a real `DbContext` (EF Core InMemory or a relational test database), including relational-only DML and audit columns | [dotnet-domain-repository-fixtures.md](dotnet-domain-repository-fixtures.md) |
| A behavior-preserving refactor that moves responsibilities or reassembles a query | [dotnet-characterization.md](dotnet-characterization.md) |
| Any Angular spec | [client-conventions.md](client-conventions.md) |
| Component fixtures, form or custom control behavior | [client-components.md](client-components.md) |
| Signal inputs, `model()`, signal effects, `store.selectSignal()` | [client-signals.md](client-signals.md) |
| NgRx effects, including reducer-driven sequences | [client-effects.md](client-effects.md) |
| Real Kendo Grid, Chart, pager, popup, editor or Excel behavior | [client-kendo.md](client-kendo.md) |
| Modal, popover, dropdown, drawer or dialog dismissal or focus | [client-overlays.md](client-overlays.md) |
| Running .NET tests | rule `dotnet-build-loops` |
| Running Angular tests | rule `client-build-loops` |

## What to test

Start from the requirement, acceptance criteria or user flow, then read the code for what they miss. Spend effort in this order:

1. Tenant scoping, permissions and access restrictions, including the denied case.
2. Money, personal data and writes that must not repeat or leak.
3. Boundaries: thresholds, exact limits, and null or empty values production can reach.
4. Failures that change state or what the user is told.
5. Ordinary behavior, once.

## Existing tests first

Before adding a test, find the tests for that behavior and mark each keep, strengthen, replace or delete. Delete a test when its behavior is gone, or when another test proves the same thing. Extend an existing test or table before adding a new one. Whether an Angular spec is created or extended follows the spec creation boundary in [client-conventions.md](client-conventions.md).

## One behavior, one owner

- When a branch is shared, prove it once at the layer that owns it. Callers assert only that they use it.
- When cases differ only by input, use one table (`[TestCase]`, `it.each`).
- When a function only delegates, do not repeat the tests of what it calls.
- When a guard is already proven, do not prove it again at a later lifecycle point unless that point can fail differently.

## Tests that can fail

- A guard gets a negative test: input it must reject, with the rejection asserted.
- A "does not" test also asserts the path was reached. An early return from unrelated setup otherwise passes.
- The fixture includes a value that separates correct from broken: a row outside the filter, a second page, a value on each side of the boundary.
- The name claims only what the assertions prove.
- When a predicate carries the rule, do not stop at matching it with `Arg.Any<Expression<...>>`. Unless the double runs that predicate against seeded rows, capture it with `Arg.Do` and run it against matching and non-matching rows.
- A mock must not rebuild production logic that the test then asserts.

If you are only choosing what to test, stop here. Before designing fixtures or writing a test, read an existing sibling test, then the Guidance map rows the test matches.
