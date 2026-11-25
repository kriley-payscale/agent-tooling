# .NET Unit Testing Conventions

## Test scope and fixture boundaries

Extend established fixtures and helpers with focused behavior regressions.
Service fixtures built on substitutes and the project's test doubles keep that
approach: do not introduce a custom `DbContext`, provider or persistence setup
merely to inspect database effects. Verify persistence at the repository/runtime
boundary. Do not change production contracts or visibility solely to simplify a test.

Do not add EF metadata tests merely to restate straightforward mapping
configuration. Justify them with a specific regression risk that existing
behavior tests or deployment checks do not adequately cover.

## Framework

Use the test framework the project already uses, and only that one. Another framework's package in the project file (MSTest beside NUnit, for example) does not license its attributes. Put assembly-wide one-time setup where the project already keeps it; in NUnit that is a `[SetUpFixture]` class outside any namespace.

### Collection arguments in TestCaseData

NUnit's `TestCaseData` accepts `params object[]`. A reference-type array assignable to `object[]` and intended as one test parameter must therefore be wrapped as the sole element of an `object[]`:

```csharp
yield return new TestCaseData(new object[] { proposedValues });
```

Passing that array directly expands its elements into test arguments: an empty array supplies no arguments, a single item supplies the DTO instead of the array, and multiple items supply too many arguments. These cases fail during NUnit binding before the SUT runs. Ordinary collections that are not assignable to `object[]`, such as `List<T>`, do not have this params-expansion behavior.

## Files, names and structure

Match the sibling tests: file suffix (`*Tests.cs` is common), folder, test class name, the SUT and substitute field names, and test method naming (`MethodName_Scenario_ExpectedOutcome` is common). Do not start a second convention in a file.

- `[SetUp]` owns substitute creation and SUT construction. Individual tests only configure scenario-specific `.Returns()`, exceptions or override values. A substitute re-created inside a test is not the one the SUT holds, so configuring or asserting it proves nothing.
- Keep Arrange in the test body. Move setup to `[SetUp]` only when it applies to every test in the fixture.
- Structure each test that has an arrange step as Arrange, Act, Assert, with `// Arrange`, `// Act`, `// Assert` markers when the sibling tests use them.

```csharp
[TestFixture]
public class WidgetServiceTests
{
    private WidgetService _sut;
    private IWidgetRepository _widgetRepository;
    private ILogger<WidgetService> _logger;

    [SetUp]
    public void SetUp()
    {
        _widgetRepository = Substitute.For<IWidgetRepository>();
        _widgetRepository.GetByIdAsync(Arg.Any<int>()).Returns(WidgetTestData.Widget());
        _logger = Substitute.For<ILogger<WidgetService>>();

        _sut = new WidgetService(_widgetRepository, _logger);
    }

    [Test]
    public void RenameAsync_WhenWidgetMissing_ThrowsNotFound()
    {
        // Arrange
        _widgetRepository.GetByIdAsync(42).Returns((Widget)null);

        // Act / Assert
        Assert.ThrowsAsync<NotFoundException>(() => _sut.RenameAsync(42, "New name"));
    }
}
```

## Mocking and test doubles

Use the mocking library the project already uses; do not add a second (Moq or FakeItEasy beside NSubstitute, for example). For `Received` on sync or async members, `Received.InOrder`, null branches, optional-parameter stubs, `Arg.Is` and async failures, read [dotnet-nsubstitute.md](dotnet-nsubstitute.md).

Before wiring a double by hand, find the test project's existing fakes and fixture helpers (search for `Fake`, `InMemory`, `Builder`, `TestData` or `Helper` classes) and how sibling tests build repositories and `IQueryable` sources. Use what exists.

- A test double must commit, delete and fail when production does, or it hides ordering bugs: the test passes against state production never has. Examples: a fake that removes rows at commit while production deletes immediately (`ExecuteDelete`, bulk deletes), one that overwrites the whole row where production writes only listed properties (EFCore.BulkExtensions `PropertiesToInclude`), or one that never throws where production does. When a fake's timing differs, stub that member to act on the same backing list at the production moment.
- To assert commit or rollback, stub the member that begins the transaction to return a substitute `IDbContextTransaction` you hold, then assert `CommitAsync` or `RollbackAsync` on that reference.
- EF Core async operators (`ToListAsync`, `FirstOrDefaultAsync`) throw on a plain `list.AsQueryable()`, which does not implement `IAsyncEnumerable<T>`. When the test project uses MockQueryable, `BuildMock()` supplies an async-capable `IQueryable<T>`.

When the SUT is a repository or query class on a real `DbContext`, read [dotnet-domain-repository-fixtures.md](dotnet-domain-repository-fixtures.md).

## Test data helpers

- Before writing inline object initialization, look for the feature's existing test-data helpers and use their methods first.
- When an existing helper method almost satisfies the need, add an optional parameter rather than a near-duplicate method.
- When two or more tests share the same complex object graph and no helper exists, extract one, placed and named like the project's existing helpers.

## Assertions

When the project uses NUnit, default to its `Assert` API in the classic or constraint (`Assert.That(..., Is.EqualTo(...))`) model, matching the style already used in the surrounding file. NUnit 4 moved the classic asserts (`AreEqual`) to `ClassicAssert`.

Do not mix NUnit `Assert.*` and FluentAssertions `.Should()` within the same file.

### ILogger\<T\> assertions

Do not assert log calls unless logging is the required behavior. `Received` on `LogError` and related extensions matches the state built by `ILogger.Log`, so only an exact plain message works. `Arg.Any<string>()` throws an NSubstitute matcher exception, and a template with arguments fails even when the call happened.

## Characterization tests

For behavior-preserving refactors that move responsibilities or reassemble a query (shared private `IQueryable`, collapsed duplicate joins, batched per-row loaders), add characterization coverage before the change when existing tests do not pin eligible IDs, nulls, empty-vs-null access lists, or page/aggregate contents.

Design the fixture per [dotnet-characterization.md](dotnet-characterization.md).
