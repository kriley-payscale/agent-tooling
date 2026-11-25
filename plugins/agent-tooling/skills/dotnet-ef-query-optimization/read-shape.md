# Read shape

## Core rules

- Page before fan-out joins when the caller only needs a page.
- A computed-column filter or sort does not license hydrating every parent. Load a narrow key at the output grain using **only** the sources the filter/sort requires, `Skip`/`Take` those keys, then hydrate the paged IDs with the existing display query.
- Before composing a read, name the predicates the caller will apply to the result. Every restriction whose inputs are already in scope before the call belongs in the query; only a predicate genuinely derived from the returned rows, such as a comparison with a neighbouring row in the materialized sequence, stays in memory.
  - The review tell needs no profiler: a `.Where(...)` over the materialized result of a repository call whose predicate inputs existed before that call.
  - This is a row-count restriction, independent of projection width: narrow rows that are mostly discarded are still the defect, so "the projection is already narrow" does not answer it.
  - A loader that serves both a restricted and an unrestricted caller takes the restriction as an optional parameter. Do not split it or filter at one call site.
- When pushing a restriction into a loader several callers share, decide per caller by reading what that caller does with the returned rows, not from its name, endpoint purpose or a stated intent to report wider or contextual data.
  - Find every reference to the materialized result and confirm at least one consumes rows the restriction would remove.
  - Only a genuine cross-scope denominator, ordering or neighbour comparison over the removed rows justifies leaving that caller out, and declining to push the restriction for a subset of callers requires that evidence recorded at the time.
  - A caller that applies the same restriction to the loader result as its first operation, and never references the unrestricted rows again, is the same defect in a second place, not a wider-scope caller.
- When reshaping a loader that several callers share, measure latency for every caller, not only the slow one. A staging change can move cost from one caller to another.
- Do not extract a shared `IQueryable` from a display query so a key query can reuse it. The display query joins lookup and detail tables the keys do not need, and reuse drags all of them into the key pass.
- Push joins and grouping to SQL when SQL can reduce rows better than C#.
- Stage queries when each stage materially shrinks the next stage, or when grain-boundary staging applies (see `cardinality.md`, Staging decision checklist).
- Do not pull broad **wide** history or detail rows into memory just to reconstruct SQL joins in C#. Narrow grain-boundary stages plus in-memory rollup are allowed.
- Normalize full-population access restrictions to unrestricted before composing query predicates.
- Preserve access semantics: `null` means unrestricted; empty list means no access.
- Use narrow projections and materialize only after filters, grouping, and pagination are placed intentionally.
- Add `TagWith()` plus structured timing logs only when investigating a measured hotspot or an explicit performance task. Do not add them during readability extracts or query-assembly cleanup.

## Sargable predicates

A predicate is seekable only when the column stands alone on one side of the comparison.

- Compare the bare column to a value or parameter. Move any arithmetic or conversion to the other side.
- Dates: use a half-open range, `x.Date >= start && x.Date < endExclusive`. Do not use `.Year`, `.Month` or `.Date` on the column.
- Do not call `ToString()` or `ToLower()` on a column to compare it. If case or type handling is in doubt, check the column's collation and type with `sql-query` instead of wrapping the column.
- Substring `Contains` on a text column cannot seek; it scans every row of the index. A prefix match can seek. If the feature needs substring search over a large table, say so and measure it rather than shipping it by default.
- A `Contains` over an id list is a different shape; see `restrictions.md`.
- A missing index goes through skill `sql-object`, whichever mechanism owns the schema, with the plan or missing-index evidence from skill `sql-query`.

## Stable ordering for `Skip`/`Take`

Pages are only consistent when the ordering is total.

- End every ordering used with `Skip`/`Take` on a unique key, normally the primary key of the output grain. Sorting on a non-unique column alone lets rows move between pages or appear twice.
- A second `OrderBy` replaces the first. Chain the tiebreak with `ThenBy`.
- This applies to the key query that pages IDs before hydration, not only the display query.
- When the UI needs page-number access, as a Kendo grid with a pager does, keyset pagination does not fit, so `Skip`/`Take` with a unique tiebreak key is the rule. The paging contract is in skill `server-side-pagination`.
