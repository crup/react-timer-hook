# API Specification

This file is the TypeScript-level API contract for the planned v1 implementation.

The API intentionally avoids timer modes. There is no `mode: 'countdown' | 'stopwatch' | 'clock'`. Consumers derive those concepts from raw data.

## Exports

```ts
export { useTimer } from './useTimer';
export { useTimerGroup } from './useTimerGroup';
export { durationParts } from './durationParts';

export type {
  DurationParts,
  TimerControls,
  TimerDebug,
  TimerDebugEvent,
  TimerDebugLogger,
  TimerEndPredicate,
  TimerGroupItem,
  TimerGroupItemControls,
  TimerGroupResult,
  TimerSchedule,
  TimerSnapshot,
  TimerStatus,
  UseTimerGroupOptions,
  UseTimerOptions,
};
```

## `durationParts`

```ts
type DurationParts = {
  totalMilliseconds: number;
  totalSeconds: number;
  milliseconds: number;
  seconds: number;
  minutes: number;
  hours: number;
  days: number;
};

function durationParts(milliseconds: number): DurationParts;
```

Rules:

- Clamp negative input to zero.
- Truncate fractional milliseconds.
- Do not format strings.
- Do not pad numbers.
- Do not apply locale or timezone behavior.

## Timer Snapshot

```ts
type TimerStatus = 'idle' | 'running' | 'paused' | 'ended' | 'cancelled';

type TimerSnapshot = {
  status: TimerStatus;

  now: number;
  tick: number;

  startedAt: number | null;
  pausedAt: number | null;
  endedAt: number | null;
  cancelledAt: number | null;
  cancelReason: string | null;

  elapsedMilliseconds: number;

  isIdle: boolean;
  isRunning: boolean;
  isPaused: boolean;
  isEnded: boolean;
  isCancelled: boolean;
};
```

Field semantics:

- `now` is the latest wall-clock timestamp from `Date.now()`.
- `tick` increments by one for each scheduler update.
- `startedAt`, `pausedAt`, `endedAt`, and `cancelledAt` are wall-clock timestamps.
- `elapsedMilliseconds` is active elapsed duration and excludes paused time.
- `elapsedMilliseconds` should use `performance.now()` internally where available.
- Boolean flags are derived from `status`.

`now` is useful for wall-clock deadlines and clocks. `elapsedMilliseconds` is useful for stopwatches and pausable duration countdowns.

## Timer Controls

```ts
type TimerControls = {
  start(): void;
  pause(): void;
  resume(): void;
  reset(options?: { autoStart?: boolean }): void;
  restart(): void;
  cancel(reason?: string): void;
};
```

Control semantics:

- `start()` starts an idle timer.
- `start()` is a no-op if the timer is running.
- `start()` is a no-op if the timer is paused; use `resume()`.
- `start()` is a no-op if the timer is ended or cancelled; use `restart()` or `reset({ autoStart: true })`.
- `pause()` pauses a running timer.
- `pause()` is a no-op outside the running state.
- `resume()` resumes a paused timer.
- `resume()` is a no-op outside the paused state.
- `reset()` moves the timer to idle, clears terminal fields, resets elapsed time, and creates a new generation.
- `reset({ autoStart: true })` resets then starts.
- `restart()` resets then starts.
- `cancel(reason)` terminally cancels an idle, running, or paused timer.
- `cancel(reason)` never calls `onEnd`.

Controls returned by hooks should be referentially stable across rerenders.

## useTimer

```ts
type TimerEndPredicate = (snapshot: TimerSnapshot) => boolean;

type UseTimerOptions = {
  autoStart?: boolean;
  updateIntervalMs?: number;
  endWhen?: TimerEndPredicate;
  onEnd?: (
    snapshot: TimerSnapshot,
    controls: TimerControls
  ) => void | Promise<void>;
  schedules?: TimerSchedule[];
  debug?: TimerDebug;
};

function useTimer(options?: UseTimerOptions): TimerSnapshot & TimerControls;
```

Defaults:

- `autoStart`: `false`
- `updateIntervalMs`: `1000`
- `endWhen`: omitted means the timer does not end automatically
- `schedules`: `[]`
- `debug`: disabled

Validation:

- `updateIntervalMs` must be finite and greater than zero.
- Invalid `updateIntervalMs` should throw `RangeError`.

## Timer Schedules

```ts
type TimerSchedule = {
  id?: string;
  everyMs: number;
  leading?: boolean;
  overlap?: 'skip' | 'allow';
  callback: (
    snapshot: TimerSnapshot,
    controls: TimerControls
  ) => void | Promise<void>;
};
```

Rules:

- Schedules run only while the timer is running.
- `everyMs` must be finite and greater than zero.
- `overlap` defaults to `skip`.
- `leading` defaults to `false`.
- `leading: true` runs the schedule when it becomes active, including start, restart, and resume.
- `overlap: 'skip'` means a pending async callback prevents the next callback for that schedule from starting.
- `overlap: 'allow'` means callbacks may overlap.
- Schedule callbacks receive controls so they can `cancel`, `restart`, or pause without closing over the returned hook object.
- Stale schedule callbacks must not affect a newer generation.

## Debug Logging

```ts
type TimerDebug =
  | boolean
  | TimerDebugLogger
  | {
      enabled?: boolean;
      logger?: TimerDebugLogger;
      includeTicks?: boolean;
      label?: string;
    };

type TimerDebugLogger = (event: TimerDebugEvent) => void;

type TimerDebugEvent = {
  type:
    | 'timer:start'
    | 'timer:pause'
    | 'timer:resume'
    | 'timer:reset'
    | 'timer:restart'
    | 'timer:cancel'
    | 'timer:end'
    | 'timer:tick'
    | 'scheduler:start'
    | 'scheduler:stop'
    | 'schedule:start'
    | 'schedule:skip'
    | 'schedule:end'
    | 'schedule:error'
    | 'callback:error';
  scope: 'timer' | 'timer-group';
  label?: string;
  timerId?: string;
  scheduleId?: string;
  generation: number;
  tick: number;
  now: number;
  elapsedMilliseconds: number;
  status: TimerStatus;
  reason?: string;
  error?: unknown;
};
```

Rules:

- No debug events are emitted unless `debug` is explicitly enabled.
- `debug: true` may call `console.debug(event)`.
- `debug: loggerFn` calls `loggerFn(event)`.
- `debug: { logger }` calls that logger only when `enabled !== false`.
- Tick logs should be disabled by default unless `includeTicks` is true. Lifecycle, scheduler, schedule, and error logs can be emitted when debug is enabled.
- Debug events should not expose raw timeout handles.
- Debug events are not a substitute for scheduler tests.

## useTimerGroup

```ts
type TimerGroupItem = {
  id: string;
  autoStart?: boolean;
  endWhen?: TimerEndPredicate;
  onEnd?: (
    snapshot: TimerSnapshot,
    controls: TimerGroupItemControls
  ) => void | Promise<void>;
  schedules?: TimerSchedule[];
};

type UseTimerGroupOptions = {
  updateIntervalMs?: number;
  items?: TimerGroupItem[];
  debug?: TimerDebug;
};

type TimerGroupItemControls = {
  start(): void;
  pause(): void;
  resume(): void;
  reset(options?: { autoStart?: boolean }): void;
  restart(): void;
  cancel(reason?: string): void;
};

type TimerGroupResult = {
  now: number;
  size: number;
  ids: string[];

  get(id: string): TimerSnapshot | undefined;

  add(item: TimerGroupItem): void;
  update(id: string, item: Partial<Omit<TimerGroupItem, 'id'>>): void;
  remove(id: string): void;
  clear(): void;

  start(id: string): void;
  pause(id: string): void;
  resume(id: string): void;
  reset(id: string, options?: { autoStart?: boolean }): void;
  restart(id: string): void;
  cancel(id: string, reason?: string): void;

  startAll(): void;
  pauseAll(): void;
  resumeAll(): void;
  resetAll(options?: { autoStart?: boolean }): void;
  restartAll(): void;
  cancelAll(reason?: string): void;
};

function useTimerGroup(options?: UseTimerGroupOptions): TimerGroupResult;
```

Rules:

- The group uses one shared recursive `setTimeout` loop.
- It must not create one loop per item.
- Each item has independent lifecycle state.
- New `items` IDs are added.
- Removed `items` IDs are cleaned up.
- Existing `items` IDs preserve lifecycle state across rerenders.
- Updating `endWhen`, `onEnd`, or `schedules` updates future behavior without resetting state.
- Duplicate `items` IDs should throw a predictable error.
- `get(id)` returns `undefined` for missing IDs.
- `remove(id)` cleans up pending schedule state for that item.
- `clear()` removes all items and stops the group scheduler if no active items remain.

## Recipes

### Absolute Deadline

```tsx
const timer = useTimer({
  autoStart: true,
  endWhen: snapshot => snapshot.now >= expiresAt,
});

const remainingMs = Math.max(0, expiresAt - timer.now);
```

### Pausable Countdown

```tsx
const timer = useTimer({
  autoStart: true,
  endWhen: snapshot => snapshot.elapsedMilliseconds >= durationMs,
});

const remainingMs = Math.max(0, durationMs - timer.elapsedMilliseconds);
```

### Stopwatch

```tsx
const timer = useTimer({ updateIntervalMs: 100 });
const elapsedMs = timer.elapsedMilliseconds;
```

### Clock

```tsx
const timer = useTimer({ autoStart: true, updateIntervalMs: 1000 });
const date = new Date(timer.now);
```
