# Component state and lifecycle

## Injection and component API

Use `inject()` for new dependencies. Abstract base classes may retain constructor injection with `// eslint-disable-next-line @angular-eslint/prefer-inject`.

```typescript
private store = inject<Store<fromReducer.State>>(Store);
private router = inject(Router);

selectedItem = input.required<MyItem>();
projectId = input<number>();
closeDrawer = output<void>();
itemSelected = output<MyItem>();
```

Use signal inputs and `output()` for new APIs, rather than `@Input()`/`@Output()`/`EventEmitter`. Name outputs as intent events rather than native DOM names or aliases: prefer `copyRequested`, `deleteRequested`, `submitted`, `valueChanged` over `copy`, `delete`, `submit`, `change`.

Preserve an existing `model()` two-way contract; its generated `<property>Change` is an output, not an instance `EventEmitter`. Use `model()` only when the component actually owns an editable two-way value, not as a way to mutate parent-owned readonly input. A model input is not a Reactive Forms CVA; changed form-control behavior follows skill `client-angular-forms`.

## State binding and derivation

Signals are standard for new component state binding; do not introduce new template `async` bindings or local `BehaviorSubject`/`Subject` state.

```typescript
readonly isLoading = this.store.selectSignal(fromReducer.getIsLoading);
readonly items = this.store.selectSignal(fromReducer.getItems);
readonly isExpanded = signal(false);
readonly displayName = computed(() => this.selectedItem().name ?? '');
```

A connected child selects the slice it renders; rule `client-component-conventions` owns child versus parent Store responsibilities.

Keep complex merges/debounce/retry in RxJS and convert once at the binding boundary with `toSignal()` instead of subscribing to copy observable emissions into a field:

```typescript
readonly filteredItems = toSignal(
  this.store.select(fromReducer.getItems).pipe(map(items => items.filter(i => i.active))),
  { initialValue: [] }
);
```

Choose an initial value that matches the template's loading/empty contract.

When a legacy child requires an observable input, use `toObservable()` at that boundary. Do not retain an intermediate computed property unless the class or template also reads it:

```typescript
readonly isOpen$ = toObservable(computed(() => this.modalState().isOpen));
```

## Side effects and timing

Use `effect()` for side effects that react to signal changes; use `ngOnInit` for one-time non-reactive initialization such as loading a list on mount. Preserve an existing view/content hook when its work requires the initialized view/content; do not move it into a constructor effect just to change syntax.

```typescript
constructor() {
  effect(() => {
    const id = this.projectId();
    if (id) {
      this.store.dispatch(MyActions.loadItem({ id }));
    }
  });
}

ngOnInit(): void {
  this.store.dispatch(MyActions.loadList());
}
```

Keep async request ordering/cancellation in the existing RxJS/NgRx workflow rather than inventing a component state mirror.

- Use `computed()` for a pure derived value; do not copy it into writable state through an effect.
- An effect reruns for every signal it reads. Read only the signals that should trigger it, so it does not dispatch duplicate requests.
- When an effect starts a timer, listener or subscription, register `onCleanup` to cancel the previous work before each rerun and on destruction. Destroy-only cleanup does not cancel stale work between reruns.
- Create `toSignal` and `toObservable` bindings once, in the injection context or with an injector passed in, not inside a getter or reactive callback.
- Read required inputs only after Angular supplies them.
- Do not assert synchronous emission (`requireSync`) unless the source guarantees it.
- `toSignal` normally tears down with its owning context; do not opt into manual cleanup without owning its lifetime. Manually created long-lived work needs explicit destruction.

For a necessary imperative subscription, preserve existing teardown or use `takeUntilDestroyed`; outside the injection context pass the owning `DestroyRef`. Do not migrate unrelated legacy subscriptions/hooks or add abstractions.

Verify changed dependencies, repeat emissions or input changes, cancellation and destruction as applicable. Spec mechanics for signal inputs and Store mocks are in `{CURSOR}/skills/unit-test-guidance/client-signals.md`.
