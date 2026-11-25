# Characterization fixtures

## Distinguish the behavior from its bug

A characterization fixture must be able to tell the behavior from its bug. It cannot when:

- the fixture seeds fewer rows than intended, so the collapse or exclusion never has anything to act on;
- the in-memory provider evaluates a set operator with different semantics than the server, so the assertion holds for a reason the production query does not share;
- a `Concat`/`Union` of independent halves is reached through one half only (next section).

Deduplication, distinct, and exclusion assertions are the most exposed: "one row came back" is the expected result of both the behavior and the bug. Seed rows that would collapse if the guard were wrong, include a row outside the filter, and assert the row count.

## `Concat` and `Union` halves

When characterizing a query assembled as a `Concat` (or `Union`) of independent halves, a predicate added to the query has to be applied to each half separately. A fixture that only reaches the result through one half passes with the predicate on one side and missing on the other.

- Seed at least one row that reaches the result through each half, and choose the discriminating value so that a half left unfiltered contributes an extra group.
- Assert on the group count, not only on the values inside the matched group; an unfiltered half usually adds a row rather than corrupting an existing one.
- Do not also apply the new predicate to an anti-join (or similar) that exists only to keep the halves disjoint; narrowing that list changes which half a row arrives through.
