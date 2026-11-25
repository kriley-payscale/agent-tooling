# pr-review — .NET routing

How to match and load: step 4 in [SKILL.md](SKILL.md). Paths are relative to `{DOTNET}`. Match by file kind; project and folder names vary by codebase.

| Changed path | Load |
|---|---|
| Repositories (`**/*Repository.cs`, `**/Repositories/**`) | `{CURSOR}/rules/dotnet-repositories.mdc`, `{CURSOR}/rules/dotnet-async-hygiene.mdc`, `{CURSOR}/rules/dotnet-project-integrity.mdc`. A new predicate, join, or order key also reads the target table's indexes in the schema source (X7) |
| Services (`**/*Service.cs`) | `{CURSOR}/rules/dotnet-service-conventions.mdc`, `{CURSOR}/rules/dotnet-error-handling.mdc`, `{CURSOR}/rules/dotnet-async-hygiene.mdc` |
| Repository method selection, query assembly or persistence changes in repositories or services | `{CURSOR}/rules/dotnet-repositories.mdc`, `{CURSOR}/skills/dotnet-data-access/SKILL.md` |
| Inserts, updates, deletes, bulk writes, SaveChanges ownership or transaction changes | `{CURSOR}/skills/dotnet-data-access/writes.md`, `{CURSOR}/rules/dotnet-audit-fields.mdc` |
| New domain repository, stored-procedure calls, LINQ join mechanics or query-assembly extracts | `{CURSOR}/skills/dotnet-data-access/domain-repository.md` |
| Query-stop behavior named in `dotnet-repositories`, or slow EF reads/translation investigation | `{CURSOR}/skills/dotnet-ef-query-optimization/SKILL.md`, then its condition-selected references |
| Service or repository interfaces (`I*Service.cs`, `I*Repository.cs`), `**/*Decorator.cs` | `{CURSOR}/rules/dotnet-decorators.mdc` |
| Other service-layer files | `{CURSOR}/rules/dotnet-async-hygiene.mdc`, `{CURSOR}/rules/dotnet-error-handling.mdc` |
| Entities, the DbContext, entity configurations (`IEntityTypeConfiguration<T>`) | `{CURSOR}/rules/dotnet-entity-naming.mdc`; the mapped table's definition in the schema source or migrations (X1) |
| DTOs and view models (`*Dto.cs`, `*ViewModel.cs`, `**/Dtos/**`) | `{CURSOR}/rules/dotnet-project-integrity.mdc` (DTO placement, ready/complete flags default `false`); the client consumers of the shape (cross-layer hunts) |
| Controllers (`*Controller.cs`) | `{CURSOR}/rules/dotnet-controller-conventions.mdc`, `{CURSOR}/skills/dotnet-controller/SKILL.md`, `{CURSOR}/rules/dotnet-error-handling.mdc`; `{CURSOR}/skills/api-auth/SKILL.md` for L4 checks. When the rule and the skill's template disagree on where the tenant or user ID comes from, the rule wins (N23) |
| Host startup, middleware and filters (`Program.cs`, `Startup.cs`) | `{CURSOR}/rules/dotnet-project-integrity.mdc` (host project dependencies), `{CURSOR}/rules/dotnet-async-hygiene.mdc`; the global authorization setup for N24 |
| The DI registration file (`git grep -l -e AddScoped -e builder.Services -- '*.cs'`) | `{CURSOR}/rules/dotnet-service-conventions.mdc` (DI lifetimes), `{CURSOR}/rules/dotnet-decorators.mdc` (cache decorators), `{CURSOR}/skills/dotnet-service/SKILL.md` |
| Test projects (`**/*Tests.cs`) | `{CURSOR}/skills/unit-test-guidance/SKILL.md`, `{CURSOR}/skills/unit-test-guidance/dotnet-conventions.md`; its leaves for the exercised NSubstitute, domain-repository fixture or characterization behavior |
| `**/*.csproj`, `Directory.Build.props`, `Directory.Packages.props` | `{CURSOR}/rules/dotnet-project-integrity.mdc` (references inside the solution, package versions, no new project without approval) |
| `helm/**`, `Tiltfile*`, files the Tiltfile loads | `{CURSOR}/rules/tilt-conventions.mdc`, `{CURSOR}/rules/tilt-dotnet-live-update.mdc` |
| Authorization attributes, policies or permission constants | `{CURSOR}/rules/dotnet-controller-conventions.mdc` (Authorization) |
