# Overlay specs

## Overlay dismissal and focus coverage

For a modal, popover, dropdown, drawer, or dialog, inventory every dismissal path the control actually supports before writing tests:
- close button
- Cancel
- Escape
- backdrop or outside click
- successful submit
- programmatic close

Do not invent interactions the control does not support. For each supported path, assert these contracts separately:
1. expected business output or state change,
2. overlay visibility or open state,
3. focus restoration to the element that opened the overlay.

An assertion that dismissal emits nothing proves only the business-output contract. It does not prove that the overlay closed or that keyboard focus returned correctly.

```typescript
it('should close without emitting and return focus to the opener', () => {
  const opener = fixture.nativeElement.querySelector(
    '[data-qa-id="btn-open"]'
  ) as HTMLButtonElement;
  const outputSpy = jest.fn();
  component.confirmed.subscribe(outputSpy);

  opener.focus();
  opener.click();
  fixture.detectChanges();

  const closeButton = fixture.nativeElement.querySelector(
    '[data-qa-id="btn-close"]'
  ) as HTMLButtonElement;
  closeButton.click();
  fixture.detectChanges();

  expect(outputSpy).not.toHaveBeenCalled();
  expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(opener);
});
```

Use `jest.useFakeTimers()` only when the component intentionally defers focus. Advance the required timer, then restore real timers in `afterEach` so later specs cannot inherit the fake clock.

### Modal wrapper and ng-bootstrap dismissal in TestBed

Pick the proof the spec owns. When the overlay is a shared modal wrapper component, a local stub (same selector, the inputs the caller binds, its dismissal output, `ng-content` for projected slots) keeps projected content queryable and proves only the caller's dismissal wiring. To prove the dismissal paths themselves on ng-bootstrap's `NgbModal`, import the real wrapper and `NgbModalModule`, and do not use `NO_ERRORS_SCHEMA`:

- When `NgbModal.open` passes a `container` that the component itself renders, render closed first, call `detectChanges()`, then open and await `whenStable()`. Opening on the initial pass throws that the modal container was not found.
- Set `TestBed.inject(NgbConfig).animation = false`.
- Query the modal's controls on `document`: the modal window renders outside the fixture's element, in `body` by default.
- Send Escape as a `keydown` with `key: 'Escape'` on `ngb-modal-window`, then await one `requestAnimationFrame` before asserting. ng-bootstrap dismisses inside that frame and rejects the modal's `result` promise, which is where a wrapper's dismissal output usually comes from.
- Call `NgbModal.dismissAll()` in `afterEach`; remove any test-owned body nodes and restore global/timer mocks.
- Exercise each configured dismissal option and caller-projected action through the actual controls. A disabled Cancel is not a supported user dismissal path; prove the intended disabled/hidden state and the working projected action separately. Coordinate caller-owned close state and reset assertions with the modal form contract in `{CURSOR}/skills/client-angular-forms/SKILL.md` (Modal forms) rather than assuming an emitted output closed/reset the view.
