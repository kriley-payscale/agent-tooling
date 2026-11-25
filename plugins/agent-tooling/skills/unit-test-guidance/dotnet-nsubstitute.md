# NSubstitute edge cases

## Await `Received()` only for async members

`Received()` / `DidNotReceive()` return the substituted method's own return type — not a `Task`. Await the assertion only when the method being asserted is async.

A repository's synchronous `BeginTransaction(IsolationLevel)` returns `IDbContextTransaction`, which has no `GetAwaiter`. Awaiting that assertion is a CS1061 compile error, not a runtime failure:

```csharp
// correct — sync member, no await
_myFeatureRepository.Received(1).BeginTransaction(IsolationLevel.ReadCommitted);

// correct — async members
await _myFeatureRepository.Received(1).SaveChangesAsync(Arg.Any<int>());

// wrong — CS1061: IDbContextTransaction has no GetAwaiter
await _myFeatureRepository.Received(1).BeginTransaction(Arg.Any<IsolationLevel>());
```

## `Received.InOrder` with async members — synchronous lambda

When asserting call order with `Received.InOrder` and the asserted members are async, pass a synchronous lambda that invokes the members without awaiting them. NSubstitute records the calls; the returned tasks are irrelevant.

```csharp
// correct — synchronous lambda; calls are recorded, tasks discarded
Received.InOrder(() => {
    repo.FooAsync(Arg.Any<int>());
    transaction.CommitAsync(Arg.Any<CancellationToken>());
});

// wrong — binds to Action and compiles to async void
Received.InOrder(async () => {
    await repo.FooAsync(Arg.Any<int>());
    await transaction.CommitAsync(Arg.Any<CancellationToken>());
});
```

Do not write the `async` form. That lambda binds to `Action` and compiles to `async void`, which rule `dotnet-async-hygiene` bans and which can let assertion exceptions escape the test.

## Recursive auto-values and null branches

NSubstitute automatically returns recursive substitutes for members whose return type is an interface, delegate, or purely virtual class. An unconfigured resolver or factory therefore may return a non-null substitute and continue into code the test did not intend to execute.

When a test must exercise a null branch, configure an explicit typed null:

```csharp
// correct — reaches the missing-strategy branch
generatorFactory.Resolve(Arg.Any<string>())
    .Returns((IMyFeatureGenerator)null);

// wrong — NSubstitute may return a recursive interface substitute
// generatorFactory.Resolve(...) is left unconfigured
```

Do not rely on an unconfigured interface-returning member to produce `null`.

## Optional parameters and stub arity

Giving an existing interface method a new optional parameter does not break any existing stub or `Received` call at compile time. C# fills the default, so every call site written at the old arity silently becomes a stub for "…and the new argument is its default". Production code that starts passing a non-null value no longer matches, and NSubstitute returns an auto-substituted empty result instead of the configured one. There is no compiler error and no explicit failure pointing at the stub; the symptom is an assertion about downstream data.

After adding an optional parameter to an interface, grep every stub and `Received` site for that method and add an `Arg.Any<T>()` for the new position, except where the test is deliberately asserting the default. A `Received` call left at the old arity is a useful assertion that the argument is its default — keep those, but only on purpose.

## `Arg.Is` predicates are expression trees

`Arg.Is<T>(predicate)` takes an `Expression<Predicate<T>>`, so the predicate cannot contain a tuple literal or a tuple `==` / `!=`. The compiler rejects it (CS8143, CS8382), and a test project that does not build is found only at build time.

```csharp
// correct — compare the components separately
await repo.Received(1).SaveAsync(Arg.Is<Pair>(pair => pair.A == expectedA && pair.B == expectedB));

// wrong — CS8382: an expression tree may not contain a tuple == or != operator
await repo.Received(1).SaveAsync(Arg.Is<Pair>(pair => (pair.A, pair.B) == (expectedA, expectedB)));
```

When the argument is too complex to compare inline, capture it with `Arg.Do<T>(captured.Add)` or inspect it in a `Returns(call => ...)` callback. Ordinary delegates, such as `Returns(call => ...)` and in-memory `.Single(x => ...)`, are not expression trees and can use tuples.

## Async failure setup

Return a faulted task when the dependency should fail asynchronously. Throwing inside a `.Returns(...)` lambda can select an ambiguous NSubstitute overload.

```csharp
var exception = new InvalidOperationException("failed");

// Task<T>
dependency.GetAsync(Arg.Any<int>())
    .Returns(Task.FromException<Result>(exception));

// Task
dependency.SaveAsync()
    .Returns(Task.FromException(exception));

// Use an explicit generic when Task<T> overloads remain ambiguous
dependency.GetAsync(Arg.Any<int>())
    .Returns<Task<Result>>(_ => Task.FromException<Result>(exception));
```

Assert the asynchronous failure through the SUT with `Assert.ThrowsAsync<TException>`; do not invoke the substitute directly as the test subject.
