---
name: dotnet-service
description: Use when creating a new .NET service with its interface, implementation, DI registration and tests. Existing-service changes use dotnet-service-conventions.
disable-model-invocation: true
---

# Add a New .NET Service

Interface, class shape, return types, logging and DI lifetimes are in rule `dotnet-service-conventions`. Where writes and `SaveChanges` live (generic repository vs specialized repository) is in rule `dotnet-repositories`.

## Step 1 — Read siblings first

1. Read a sibling interface in the feature's folder (`rg -l "interface I\w+Service\b" {DOTNET} -g '*.cs'`).
2. Read the matching implementation.
3. Read its unit test in the test project.

## Step 2 — Create the interface

**File:** `I[Name]Service.cs` beside the sibling interface, with the sibling's namespace.

```csharp
public interface I[Name]Service
{
    Task<[ReturnType]> Get[Something]Async(int tenantId, int userId);
    Task<[ReturnType]> Create[Something]Async([RequestModel] request);
    Task Update[Something]Async(int id, [RequestModel] request);
    Task Delete[Something]Async(int id, int tenantId);
}
```

## Step 3 — Create the implementation

**File:** `[Name]Service.cs` beside the sibling implementation, with the sibling's namespace and class shape.

- Inject the generic repository when the codebase has one, or a specialized repository when rule `dotnet-repositories` justifies it.
- Add `ILogger<[Name]Service>` only when the service has meaningful failure paths.
- When the data is tenant-scoped, filter every query by the codebase's tenant key.

Step 1's sibling read governs types and `using` directives. Before adding DTOs or repositories, read `{CURSOR}/rules/dotnet-project-integrity.mdc`.

## Step 4 — Register in DI

Find where the sibling service is registered: `rg -n "<SiblingInterface>\b" {DOTNET} -g '*.cs'` shows its `AddScoped<...>()` line. Add the new registration in the same group:

```csharp
services.AddScoped<I[Name]Service, [Name]Service>();
```

When the codebase registers services by convention (Scrutor `Scan` or an assembly-scanning helper), confirm the new class matches the convention instead. Create a new registration group only when the feature has none.

## Step 5 — Create the unit test class

**File:** `[Name]ServiceTests.cs` in the test project, in the folder that mirrors the sibling test's.

Follow skill `unit-test-guidance`, starting from the sibling test read in Step 1.

## Step 6 — Build and run tests

Follow rule `dotnet-build-loops` "Compilation check", then "Impacted unit tests" with the filter `FullyQualifiedName~[Name]ServiceTests`.
