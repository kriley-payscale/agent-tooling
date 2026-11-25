# Component spec fixtures

## Component fixture and assertions

Configure only the component and dependencies the test exercises. TestBed registration, schemas, stubs, mocks and QA queries follow [client-conventions.md](client-conventions.md); signal inputs follow [client-signals.md](client-signals.md).

To assert a bound directive input, query its host and get the directive instance from `DebugElement.injector`, rather than `getAttribute()`; Angular does not persist those bindings as DOM attributes:

```typescript
const host = fixture.debugElement.query(By.css('[data-qa-id="card-label"]'));
expect(host.injector.get(TruncateTooltipDirective).tooltipText).toBe('Expected label');
```

For an output, subscribe before exercising the real interaction and assert the value/count:

```typescript
const outputSpy = jest.fn();
component.closeDrawer.subscribe(outputSpy);
fixture.nativeElement.querySelector('[data-qa-id="btn-close"]').click();
expect(outputSpy).toHaveBeenCalledTimes(1);
```

For derived/controlled widgets, assert the actual template-bound value, not merely its unfiltered source.

## Form and CVA host proof

When changed form behavior is under test, the value, action and reset contracts come from skill `client-angular-forms`. Add action-specific validity/DTO/reset cases for changed modal/editor workflows without imposing whole-form validity on unrelated actions.

For a custom control, a small host component with a real typed `FormControl` and `[formControl]` (or its actual `formControlName` caller) proves integration. Import `ReactiveFormsModule` plus the real custom control's module/standalone declaration; do not schema/stub the CVA under test. Define the host's architecture explicitly and register it accordingly. Class-method tests alone cannot establish the binding.

Prove each item of the CVA contract in `{CURSOR}/skills/client-angular-forms/kendo-and-custom-controls.md`:

- Subscribe/spies before programmatic `setValue`/reset. Assert the rendered value and agreed empty shape, with no user-change output or touched callback caused by a model write. Angular's programmatic `setValue` normally emits `valueChanges`; do not mistake that for erroneous CVA user propagation.
- Drive one actual user commit and assert one parent value update/user output; blur or the supported completion interaction marks the parent touched.
- Call parent `disable()`/`enable()` and assert the real rendered control and interaction behavior, without a synthetic user value change.
- Reset values and transient draft text; exercise the next blur/Enter to prove no stale draft recommits. Preserve nullable/default and disabled-state contracts.

## Reused fixtures and structure

Inline simple one-off objects. For a repeated shape, keep one local factory with a typed `Partial` override:

```typescript
function createMockItem(overrides: Partial<MyItem> = {}): MyItem {
  return { id: 1, name: 'Default Item', active: true, ...overrides };
}
```

Use one class-named top-level `describe`; initialize fixtures/service mocks in `beforeEach` and nest scenarios/methods in `describe` blocks. Recreate shared `jest.fn()` mocks per test rather than declaring copies in every `it`. A create assertion can accompany meaningful changed-behavior coverage; it does not replace it.
