# Design Decisions

This file records the decisions made during API planning. Future implementation work should not reopen these unless there is a strong reason and a documented replacement decision.

## Decision 1: No Timer Modes

Decision:

- Do not add `mode: 'countdown' | 'stopwatch' | 'clock'`.

Reason:

- The library should expose raw time and lifecycle data.
- Consumers can derive countdowns, stopwatches, and clocks.
- Mode enums would hide business logic and make edge cases harder to reason about.

Examples:

```ts
const remainingMs = Math.max(0, expiresAt - timer.now);
const elapsedMs = timer.elapsedMilliseconds;
const date = new Date(timer.now);
```

## Decision 2: No Formatting, Timezone, or `ampm`

Decision:

- Do not add formatting.
- Do not add timezone conversion.
- Do not add `ampm`.

Reason:

- These are presentation concerns.
- Locale and timezone behavior is broad and easy to get wrong.
- Consumers can use `Intl`, `Date`, `date-fns`, `luxon`, or app-specific formatting.

Acceptable:

```ts
const date = new Date(timer.now);
const text = new Intl.DateTimeFormat(locale, options).format(date);
```

Not acceptable in the library:

```ts
timer.ampm;
timer.formatted;
timer.timeZone;
```

## Decision 3: Use `Date.now()` and `performance.now()` Without a Prop

Decision:

- Use `Date.now()` for `snapshot.now`.
- Use `performance.now()` internally for active elapsed time when available.
- Fall back to `Date.now()` for elapsed time when `performance.now()` is unavailable.
- Do not add a user prop to choose the clock source.

Reason:

- Wall-clock deadlines need wall time.
- Stopwatch elapsed time should not be skewed by system clock changes.
- A clock-source prop makes the API easier to misuse.

## Decision 4: Use Recursive `setTimeout`

Decision:

- Use recursive `setTimeout`.
- Do not use `setInterval`.
- Do not use `requestAnimationFrame`.

Reason:

- Recursive `setTimeout` is easier to clear and generation-guard.
- It avoids accidental overlapping scheduler loops.
- `requestAnimationFrame` is tied to rendering and is not appropriate for polling or background-throttled timers.

## Decision 5: Add Opt-In Debug Logs in V1

Decision:

- Include opt-in semantic debug logs in v1.
- Do not log by default.
- Do not expose raw timeout handles.

Reason:

- Timer bugs are often lifecycle and scheduler bugs.
- OSS users need a way to diagnose duplicate ticks, stale callbacks, and schedule overlap.
- Raw platform handles would leak implementation details.

Debug should report semantic events:

```ts
timer:start
timer:tick
scheduler:start
scheduler:stop
schedule:skip
timer:end
```

## Decision 6: `cancel()` Is Terminal and Separate From `pause()`

Decision:

- Use `cancel(reason?)` for early terminal stop.
- Use `pause()` only for reversible pause.
- `cancel()` must not call `onEnd`.

Reason:

- Auctions, jobs, and reservations can close before their timer naturally ends.
- Calling that state `pause` or `stop` is ambiguous.
- `cancel` communicates that the current generation is terminal.

## Decision 7: `onEnd` Is Once-Only Per Generation

Decision:

- `onEnd` fires once per generation.
- `reset()` and `restart()` create a new generation.
- Async `onEnd` must not repeat while pending.
- Stale async work must not affect a newer generation.

Reason:

- This directly addresses duplicate expire callbacks in timer libraries.
- Generation guards make restart-after-end deterministic.

## Decision 8: Schedules Are Side Effects, Not Data Fetching

Decision:

- Add `schedules` for app-owned periodic side effects.
- Default async overlap behavior to `skip`.
- Do not add retry, backoff, caching, loading, stale data, or request dedupe.

Reason:

- A timer library can run callbacks on cadence.
- It should not become React Query or SWR.

## Decision 9: `useTimerGroup` Is Worth V1

Decision:

- Include `useTimerGroup` in the planned v1 API.

Reason:

- There are real cases with many independent timer lifecycles:
  - auction rows
  - job timeout lists
  - game cooldowns
  - cart or reservation holds
  - notification expiry lists
- This is different from rendering many countdown labels.

Constraint:

- `useTimerGroup` must use one scheduler per hook instance, not one scheduler per item.

## Decision 10: Keep Compatibility With the Old Library Out of Scope

Decision:

- Do not preserve the previous `react-timer-hook` API for compatibility.

Reason:

- Compatibility would force ambiguous behavior such as `offsetTimestamp`, formatting-like fields, and countdown-specific return shapes.
- This is a replacement library with a cleaner primitive.
