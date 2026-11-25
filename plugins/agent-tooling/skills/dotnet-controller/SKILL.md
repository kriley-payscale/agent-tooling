---
name: dotnet-controller
description: Use when porting or creating an ASP.NET Core API controller, or when adding or changing controller action methods.
disable-model-invocation: true
---

# Create or Modify a .NET Controller

This skill is the order of work for a controller.

## Guidance map

| When | Read |
|---|---|
| Writing the class shape, binding attributes, request validation, tenant and user identity, OData actions or authorization attributes | rule `dotnet-controller-conventions` |
| The controller needs a service that does not exist yet | skill `dotnet-service` |
| Checking the Angular service's wrapper signatures, route or normalization | rule `client-data-api-service` |
| Contract shape, ownership or exports change | rule `client-models` |
| Changing an existing effect | rule `client-ngrx-effects` |
| Chained loads, optimistic writes, target or scope identity, request acceptance or rollback, pending records or in-flight counters | `{CURSOR}/skills/client-ngrx-feature-slice/async-workflows.md` |
| Registering a new slice | skill `client-ngrx-feature-slice` |
| Building the change | rule `dotnet-build-loops` |

## Step 1 — Read before writing

1. Read the source controller fully.
2. Identify the target feature folder under the API project's `Controllers/`.
3. Read one sibling controller from that folder.
4. Read its base class to confirm what it already declares: route template, `[ApiController]`, `[Authorize]`, the current-user accessor.

## Step 2 — Create the controller file

**File:** `<ApiProject>/Controllers/<Feature>/<Name>Controller.cs`

**Namespace:** copy the sibling's namespace exactly, including its casing. A root namespace can be cased differently from the project or folder name, and namespaces are case-sensitive: a mismatch compiles into a separate namespace that the sibling's types and `using` directives do not reach.

Inherit the sibling's base class and put the authorization attribute (and any feature-flag filter) siblings use on the class. Fields, constructor, layout and actions follow rule `dotnet-controller-conventions`.

Actions return `IActionResult` (or `ActionResult<T>` where siblings do); an action that awaits returns `async Task<IActionResult>`.

## Step 3 — Confirm URL alignment with the Angular data service

Work out the action's URL from its routing: the `[Route]` template on the controller or its base, such as `[Route("api/[controller]/[action]")]`, which gives `{origin}/api/Widget/GetItems` for `WidgetController.GetItems`; an attribute route on the action; or OData routing when the repo uses OData.

The Angular data service builds the same URL from its base URL constant, its endpoint name and the action segment (rule `client-data-api-service`). The two sides must align exactly:

| .NET | Angular data service |
|---|---|
| Controller class name without `Controller` (the `[controller]` token) | The service's endpoint name |
| Action method name (the `[action]` token) or the action's route template | The URL segment the service passes |
| `[HttpGet]`, `[HttpPost]`, ... | The matching method on the HTTP wrapper |

When a new controller is paired with a new Angular feature, also confirm the effect wiring: the NgRx effect calls the API service method, dispatches the correct success/failure actions, and the component selector reads from the correct store slice.

## Step 4 — Verify or create the service interface

Check the service interface exists beside its siblings. If not, run skill `dotnet-service` first.

## Step 5 — Register in DI

Controllers are discovered automatically — no DI registration needed for the controller itself.

If you also created a new service, follow skill `dotnet-service` Step 4 to register it.

## Step 6 — Verify the status contract

When an endpoint promises `403`, `404`, or another non-500 response from a service failure:

1. Read the service member and confirm whether it returns a result/error contract or throws, including the exact exception types.
2. Read `{CURSOR}/rules/dotnet-error-handling.mdc` "Mapping to HTTP" for what each mechanism maps, then read the mechanism this action actually uses. Never infer HTTP behavior from an exception class name; an unhandled service exception is `500` unless a mechanism explicitly maps it.
3. If the service returns the established result type, use the existing controller result handler. If it throws and no global mapper handles the exact exception, map it at the action boundary to the endpoint's planned status.
4. Add a focused controller test for each exception-to-status mapping this action owns. A mapping from a shared result handler is proven once in that handler's tests. When authenticated live API verification is in scope, exercise the negative path as well as the success path.

Mappings are endpoint contracts, not universal rules. Confirm the intended status before mapping any exception.

## Step 7 — Build

Follow rule `dotnet-build-loops` "Compilation check".
