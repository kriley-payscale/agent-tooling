# pr-review — schema routing

How to match and load: step 4 in [SKILL.md](SKILL.md). Paths are relative to `{SQL}`; EF Core migrations are under `{DOTNET}`.

| Changed path | Load |
|---|---|
| Table, view, function, procedure or type definitions | `{CURSOR}/skills/sql-object/SKILL.md`; the schema project's file list when it names files explicitly (D1) |
| Joins, predicates, or result filters in a view, procedure, or function | `{CURSOR}/skills/dotnet-ef-query-optimization/cardinality.md` (join grain, N1/N2), `{CURSOR}/skills/dotnet-ef-query-optimization/read-shape.md` (sargability, N20), `{CURSOR}/skills/sql-query/perf-diagnostics.md` for plan evidence; the .NET code that applies the same table's state filters (D8) |
| Any change to an existing table (column type, nullability, drop, rename) | `{CURSOR}/rules/scope-creep-gate.mdc`; the rename record the schema tool needs (D4); the table's ORM mapping (X1) |
| Data scripts: seeds, backfills, data fixes, pre- or post-deployment scripts | `{CURSOR}/skills/sql-data-script/SKILL.md` |
| EF Core `Migrations/**` and the model snapshot | `{CURSOR}/rules/dotnet-entity-naming.mdc`; hunts D1, D2, D4, D6 and D7 |
| Generated scripts | Flag any hand edit (D7) |
