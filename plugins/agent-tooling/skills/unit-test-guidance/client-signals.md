# Signal component specs

## WritableSignal Store mock

Mock the Store the way sibling specs do. Two styles work: a typed local mock that returns one explicit `WritableSignal` per consumed selector, or `MockStore.overrideSelector()`, which also works with memoized selectors consumed by `selectSignal()`. Do not introduce a second style in a spec, or migrate working tests solely for style. The explicit-signal mock:

```typescript
import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';

import { MyItem } from '../../models';

import { MyFeatureComponent } from './my-feature.component';
import * as fromReducer from '../../reducers';

let fixture: ComponentFixture<MyFeatureComponent>;
let itemsSig: WritableSignal<MyItem[]>;
let isLoadingSig: WritableSignal<boolean>;
let mockStore: { selectSignal: jest.Mock; dispatch: jest.Mock };

beforeEach(async () => {
  itemsSig = signal<MyItem[]>([]);
  isLoadingSig = signal(false);
  mockStore = {
    selectSignal: jest.fn((selector: unknown) => {
      if (selector === fromReducer.getItems) return itemsSig;
      if (selector === fromReducer.getIsLoading) return isLoadingSig;
      throw new Error('Unmapped selector in component spec');
    }),
    dispatch: jest.fn()
  };

  await TestBed.configureTestingModule({
    declarations: [MyFeatureComponent],
    providers: [{ provide: Store, useValue: mockStore }]
  }).compileComponents();
  fixture = TestBed.createComponent(MyFeatureComponent);
});
```

The example is non-standalone. TestBed registration, template dependencies, stubs and mock typing follow [client-conventions.md](client-conventions.md). Map all selectors read by the real child graph retained in the fixture, even when the parent no longer selects them.

Call `.set()`/`.update()` on the writable signal, render, then assert:

```typescript
itemsSig.set([{ id: 1, name: 'Widget' }]);
isLoadingSig.set(false);
fixture.detectChanges();
expect(fixture.componentInstance.items()).toHaveLength(1);
```

Match the actual selector value shape. When the selector returns a wrapper such as `{ loading, obj }` async state rather than a bare array, initialize the signal with the codebase's default-state helper, update it the same way the reducer does (`{ ...current, loading: true }`), and assert the wrapped value.

## Required inputs and reactive transitions

Signal inputs are readonly. Use `fixture.componentRef.setInput()`; never assign `component.selectedItem` directly.

```typescript
fixture = TestBed.createComponent(MyFeatureComponent);
fixture.componentRef.setInput('selectedItem', createMockItem());
fixture.componentRef.setInput('projectId', 42);
fixture.detectChanges();
```

Set all required inputs before the first `detectChanges()`. For an effect depending on input changes, test each transition as `setInput` → `detectChanges` → assert. Include repeat/replacement/cleanup behavior when that is what changed; do not rewrite unrelated component lifecycle code to simplify the fixture.

For `model()` inputs, exercise the control's public interaction or DOM control; do not assume the generated `<property>Change` is an instance `EventEmitter`.
