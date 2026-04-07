# Implementation Plan

This document describes how to implement the hooks after the API is approved.

The implementation must be test driven. Do not build implementation files first and backfill tests later.

## Recommended Stack

- TypeScript
- React 18+ peer dependency
- Vitest
- React Testing Library
- `@testing-library/react` hook test pattern through test components
- `tsup` or `rollup` for library builds
- TypeDoc for API documentation

The exact bundler can be changed, but the implementation must emit typed ESM and CJS builds unless the release plan explicitly chooses ESM-only.

## Source Layout

Recommended layout:

```txt
src/
  index.ts
  durationParts.ts
  clocks.ts
  debug.ts
  scheduler.ts
  state.ts
  types.ts
  useTimer.ts
  useTimerGroup.ts
  __tests__/
    durationParts.test.ts
    useTimer.lifecycle.test.tsx
    useTimer.schedules.test.tsx
    useTimer.strict-mode.test.tsx
    useTimer.debug.test.tsx
    useTimerGroup.lifecycle.test.tsx
    useTimerGroup.sync.test.tsx
    useTimerGroup.schedules.test.tsx
```

Keep shared timer math in pure functions where possible. Hooks should be thin React integration around deterministic state transitions and scheduler behavior.

## Scheduler Strategy

Use recursive `setTimeout`, not `setInterval`.

Reasons:

- easier to clear before scheduling the next tick
- easier to avoid duplicate loops
- easier to bind ticks to a generation
- easier to coordinate async schedules
- easier to stop on unmount, pause, cancel, reset, and end

Never call `setTimeout` during render.

Each `useTimer()` instance should have at most one active timeout loop.

Each `useTimerGroup()` instance should have at most one active timeout loop for the whole group.

Conceptual loop:

```ts
function scheduleNextTick(generation: number) {
  clearScheduledTick();

  timeoutRef.current = setTimeout(() => {
    if (!mountedRef.current) return;
    if (generationRef.current !== generation) return;
    if (stateRef.current.status !== 'running') return;

    tick(generation);
    scheduleNextTick(generation);
  }, latestOptionsRef.current.updateIntervalMs);
}
```

The actual code should avoid stale closures by storing latest options and callbacks in refs.

## Time Sources

Use both wall-clock and monotonic time, but do not expose a clock-source prop.

- `Date.now()` provides `snapshot.now` and wall timestamp fields.
- `performance.now()` provides active elapsed calculations when available.
- Fall back to `Date.now()` for monotonic calculations in non-browser or limited runtimes.

The clock helper should look conceptually like:

```ts
type ClockRead = {
  wallNow: number;
  monotonicNow: number;
};

function readClock(): ClockRead {
  const wallNow = Date.now();
  const monotonicNow =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : wallNow;

  return { wallNow, monotonicNow };
}
```

Do not read `window` during render. SSR must be safe.

## State Model

Use a reducer or reducer-like pure transition helpers.

State should include:

```ts
type InternalTimerState = {
  status: TimerStatus;
  generation: number;
  tick: number;

  startedAt: number | null;
  pausedAt: number | null;
  endedAt: number | null;
  cancelledAt: number | null;
  cancelReason: string | null;

  baseElapsedMilliseconds: number;
  activeStartedAtMonotonic: number | null;
  now: number;
};
```

`elapsedMilliseconds` can be derived:

- if `running`: `baseElapsedMilliseconds + (monotonicNow - activeStartedAtMonotonic)`
- otherwise: `baseElapsedMilliseconds`

When pausing:

- calculate elapsed with monotonic clock
- store it in `baseElapsedMilliseconds`
- set `activeStartedAtMonotonic` to `null`

When resuming:

- set `activeStartedAtMonotonic` to current monotonic time
- preserve `baseElapsedMilliseconds`

When resetting:

- increment generation
- set status to `idle`
- reset elapsed and terminal fields

When restarting:

- increment generation
- set status to `running`
- reset elapsed and terminal fields
- set started timestamps

## Ending

`endWhen` is evaluated on each tick after the snapshot is computed.

Rules:

- If `endWhen(snapshot)` returns true, transition to `ended`.
- Clear the scheduler.
- Emit debug event `timer:end` when debug is enabled.
- Call `onEnd` once per generation.
- If `onEnd` is async, do not call it repeatedly while it is pending.
- If the timer restarts before `onEnd` resolves, the stale async result must not affect the new generation.

Do not call `onEnd` from `cancel()`.

## Schedules

Schedules are side effects. They must not drive the main timer tick.

Per schedule, track:

```ts
type InternalScheduleState = {
  lastRunAt: number | null;
  pending: boolean;
};
```

Rules:

- Evaluate schedules only while running.
- Use `snapshot.now` for cadence checks.
- `leading: true` runs when a schedule becomes active.
- `overlap: 'skip'` skips if `pending` is true.
- `overlap: 'allow'` permits concurrent callbacks.
- Schedule callbacks get snapshot and controls.
- Wrap async callbacks to clear `pending` in `finally`.
- Log `schedule:error` when debug is enabled and a callback rejects.
- Re-throwing errors from async schedule callbacks is not recommended because it can produce unhandled promise noise. Prefer emitting debug and leaving app-level handling to the callback.

Open implementation decision:

- If callback errors should be swallowed, document that.
- If callback errors should be reported through `onError`, add that before coding.

Current recommendation: swallow schedule callback errors after debug logging because schedule callbacks are side effects and rejected promises should not break React render.

## Debug Logs

Debug logs are required for v1, but must be opt-in.

Implementation rules:

- If `debug` is absent or false, do not build event objects on hot tick paths unless cheap.
- `debug: true` writes to `console.debug`.
- `debug: fn` writes to that function.
- `debug: { enabled: false }` disables logs.
- `debug: { logger, includeTicks }` uses the logger and includes tick logs only when requested.
- Never log automatically in production or development unless the user enabled debug.
- Never expose raw timeout handles.
- Debug events should include enough data to reason about lifecycle and duplicate scheduling:
  - scope
  - type
  - generation
  - tick
  - timer id for group items
  - schedule id when relevant
  - status
  - now
  - elapsedMilliseconds

## React Rerender Safety

Rules:

- Controls should be stable with `useCallback`.
- Latest user callbacks should be stored in refs.
- Latest options should be stored in refs.
- Changing callback identity should not restart the scheduler.
- Changing `updateIntervalMs` can affect the next scheduled tick without creating duplicate loops.
- The scheduler effect should depend on lifecycle state and stable scheduler functions, not raw options objects.

Test this by rerendering many times and advancing fake timers. The number of ticks must be based on elapsed fake time, not render count.

## Strict Mode Safety

React Strict Mode double-invokes effects in development. The implementation must remain correct.

Test with:

```tsx
<React.StrictMode>
  <ComponentUsingTimer />
</React.StrictMode>
```

Required behavior:

- no duplicate ticks
- no duplicate `onEnd`
- no duplicate schedule callbacks for the same cadence
- cleanup is called between effect runs

## Unmount Safety

On unmount:

- clear any scheduled timeout
- mark mounted ref false
- ignore stale async callbacks
- do not call `setState`
- clear group item schedule state

Unmount tests should fail if a state update occurs after unmount.

## useTimerGroup Implementation Notes

Use a map keyed by item id.

Conceptual internal data:

```ts
type InternalGroupItem = {
  id: string;
  state: InternalTimerState;
  definitionRef: {
    autoStart?: boolean;
    endWhen?: TimerEndPredicate;
    onEnd?: TimerGroupItem['onEnd'];
    schedules?: TimerSchedule[];
  };
  schedules: Map<string, InternalScheduleState>;
  onEndCalledGeneration: number | null;
};
```

Group synchronization from `items`:

- validate duplicate ids
- add missing ids
- update definitions for existing ids without resetting state
- remove stale ids and cleanup their schedule state
- start new item if `autoStart` is true

The group scheduler should run while at least one item is running.

On each group tick:

- read clock once
- update `now` once
- compute snapshots for running items
- evaluate each running item's `endWhen`
- evaluate each running item's schedules
- dispatch one React state update for the whole group when possible

Avoid creating a separate hook or timeout per item.

## TDD Flow

1. Add type files and pure utilities only after their tests exist.
2. Start with `durationParts` tests.
3. Add lifecycle reducer tests if reducer is exported only for tests or tested through hooks.
4. Add `useTimer` lifecycle tests.
5. Add schedule tests.
6. Add debug tests.
7. Add Strict Mode and unmount tests.
8. Add `useTimerGroup` tests.
9. Add build and type tests.
10. Only then update examples and docs.
