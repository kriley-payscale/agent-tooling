# Effects specs

## Single-shot setup

```typescript
import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Action } from '@ngrx/store';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { Observable, of, throwError } from 'rxjs';
import { take } from 'rxjs/operators';

import { MyApiService } from '../../services/my-api.service';

import { MySliceEffects } from './my-slice.effects';
import { MySliceActions } from '../actions/my-slice.actions';
import * as fromReducer from '../reducers';

type MyApiServiceMock = jest.Mocked<Pick<MyApiService, 'getItems'>>;

describe('MySliceEffects', () => {
  let effects: MySliceEffects;
  let actions$: Observable<Action>;
  let apiService: MyApiServiceMock;
  let store: MockStore;

  beforeEach(() => {
    apiService = { getItems: jest.fn() };
    TestBed.configureTestingModule({
      providers: [
        MySliceEffects,
        provideMockActions(() => actions$),
        provideMockStore(),
        { provide: MyApiService, useValue: apiService }
      ]
    });
    effects = TestBed.inject(MySliceEffects);
    store = TestBed.inject(MockStore);
    store.overrideSelector(fromReducer.getSelectedItem, null);
    store.refreshState();
  });

  afterEach(() => store.resetSelectors());

  it('should dispatch loadItemsSuccess on successful API call', (done) => {
    const mockItems = [createMockItem()];
    apiService.getItems.mockReturnValue(of(mockItems));
    actions$ = of(MySliceActions.loadItems());

    effects.loadItems$.pipe(take(1)).subscribe(action => {
      expect(action).toEqual(MySliceActions.loadItemsSuccess({ items: mockItems }));
      done();
    });
  });

  it('should dispatch loadItemsError on API error', (done) => {
    apiService.getItems.mockReturnValue(throwError(() => new Error('network error')));
    actions$ = of(MySliceActions.loadItems());

    effects.loadItems$.pipe(take(1)).subscribe(action => {
      expect(action).toEqual(MySliceActions.loadItemsError());
      done();
    });
  });
});
```

Use the target file's actual action constructor or creator, real payload and failure suffix (rule `client-ngrx-actions`); the `Error` suffix here is only an example.

- Use `provideMockActions(() => actions$)`, not a real `Actions` stream. Set `actions$ = of(TriggerAction())` before subscribing for a single-shot test; use `take(1)` plus `done` and ordinary `of`/`throwError`, unless sibling effects specs use marbles; then match them.
- For fixed-state tests, override every selector newly consumed through `concatLatestFrom`/`withLatestFrom` before subscription, then `refreshState()`. Put normal defaults in `beforeEach`, varying only the needed states. A composed selector against empty feature state can throw inside its projector.
- Reset mocks per test. Capture and clean up subscriptions/Subjects when the assertion does not complete them.

## Stateful reducer-before-effect ordering

A single `of()` cannot express a Store transition while an effect waits, or an earlier session's result arriving later. Use a `Subject<Action>` and the real feature reducers when the property under test is that a reducer transition unblocks/blocks the effect:

1. Initialize the real root/feature state shape.
2. Define the test's dispatch path to fold each action through the relevant real reducers and call `MockStore.setState(nextState)` **before** pushing the same action into the actions Subject. Match NgRx's reducer-before-effects ordering.
3. Subscribe to the effect before driving actions. If later behavior depends on an emitted action's reducer transition, feed that action through the same dispatch path; merely collecting outputs does not advance Store state.
4. Use controllable API-response Subjects for in-flight, delayed and queued responses. Assert the changed behavior at the relevant transition, not only final output.
5. Complete Subjects and unsubscribe in `afterEach`.

Prefer this over `overrideSelector` for reducer-transition behavior. Fixed-state selector overrides remain appropriate for single-shot effects. For chained loads, optimistic writes, target or scope identity, request acceptance or rollback, pending records or in-flight counters, the required cases are in `{CURSOR}/skills/client-ngrx-feature-slice/async-workflows.md`.

Mock typing and `resetSelectors()` cleanup for selector overrides follow [client-conventions.md](client-conventions.md).
