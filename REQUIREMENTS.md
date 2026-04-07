# React Timer Hook Requirements

This document is the canonical product and engineering specification for the replacement `react-timer-hook` library.

The goal is not to clone the old API. The goal is to build a smaller, deterministic, React-safe timer primitive that can be used for countdowns, stopwatches, clocks, polling, and many independent timer lifecycles without adding formatting, timezone, or app-specific business logic.

## Design Principles

- Ship a small public surface: `useTimer` and `useTimerGroup`.
- Do not expose mode enums such as `countdown`, `stopwatch`, or `clock`.
- Do not format time strings.
- Do not bake in timezone or locale behavior.
- Do not expose platform timer handles such as `setTimeout` IDs.
- Use deterministic raw data so consumers can derive their own UI and business behavior.
- Treat lifecycle status as timer mechanics, not business state.
- Use TDD for the implementation.
- Make correctness under React rerenders, Strict Mode, async callbacks, and unmount cleanup the differentiator.

## Public API V1

The v1 public API should export only:

```ts
useTimer(options?: UseTimerOptions): TimerSnapshot & TimerControls;
useTimerGroup(options?: UseTimerGroupOptions): TimerGroupResult;
durationParts(milliseconds: number): DurationParts;
```

`durationParts` is allowed as a pure utility because it does not format, localize, or schedule anything. It only decomposes a duration into numeric parts.

## Core Types

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

type TimerControls = {
  start(): void;
  pause(): void;
  resume(): void;
  reset(options?: { autoStart?: boolean }): void;
  restart(): void;
  cancel(reason?: string): void;
};

type TimerEndPredicate = (snapshot: TimerSnapshot) => boolean;

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

Debug logging is a v1 requirement. It must be opt-in. The library must not log anything by default. `debug: true` may log with `console.debug`; passing a function or logger object must route all debug events to that logger instead.

Debug events must be semantic events. Do not expose raw `setTimeout` handles, interval IDs, DOM handles, or internal mutable refs.

## useTimer

```ts
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
```

Default behavior:

- `autoStart` defaults to `false`.
- `updateIntervalMs` defaults to `1000`.
- `overlap` in schedules defaults to `skip`.
- `leading` in schedules defaults to `false`.
- `onEnd` is optional.
- `endWhen` is optional. If omitted, the timer never ends by itself.
- `debug` defaults to disabled.

Input validation:

- Missing `updateIntervalMs` uses the default.
- `updateIntervalMs` must be a finite positive number.
- `everyMs` in a schedule must be a finite positive number.
- Invalid time intervals should fail predictably with `RangeError`.

Lifecycle semantics:

- `start()` transitions `idle` to `running`.
- `start()` is a no-op when already `running`.
- `start()` is a no-op when `paused`; use `resume()` instead.
- `start()` is a no-op when `ended` or `cancelled`; use `restart()` or `reset({ autoStart: true })`.
- `pause()` transitions `running` to `paused`.
- `pause()` is a no-op in other states.
- `resume()` transitions `paused` to `running`.
- `resume()` is a no-op in other states.
- `reset()` transitions any state to `idle`, clears end/cancel fields, resets elapsed time to zero, and creates a new generation.
- `reset({ autoStart: true })` transitions to `running` after resetting.
- `restart()` resets and starts immediately.
- `cancel(reason)` transitions `idle`, `running`, or `paused` to `cancelled`.
- `cancel(reason)` does not call `onEnd`.
- `cancel(reason)` is a no-op when already `ended` or `cancelled`.

Generation semantics:

- A generation is a single timer run identity.
- `reset()` creates a new generation.
- `restart()` creates a new generation.
- `onEnd` fires at most once per generation.
- Async `onEnd` must not fire repeatedly while pending.
- Async schedule callbacks must not mutate or end a stale generation after `reset()`, `restart()`, `cancel()`, or unmount.

Clock semantics:

- `now` is a wall-clock timestamp from `Date.now()`.
- `elapsedMilliseconds` is active elapsed duration and should be based on a monotonic clock, using `performance.now()` when available and falling back to `Date.now()`.
- `elapsedMilliseconds` excludes paused time.
- `startedAt`, `pausedAt`, `endedAt`, and `cancelledAt` are wall-clock timestamps.

Important consumer derivation rules:

- Use `expiresAt - timer.now` for absolute wall-clock deadlines, such as auctions that end at a server-defined timestamp.
- Use `durationMs - timer.elapsedMilliseconds` for pausable duration countdowns.
- Use `timer.elapsedMilliseconds` for stopwatches.
- Use `new Date(timer.now)` for clocks.

## useTimerGroup

`useTimerGroup` is for many keyed independent lifecycles driven by one shared scheduler.

It is justified for cases like:

- auction lists where each row can pause, resume, cancel, or end independently
- game cooldown lists
- reservation or cart hold lists
- job timeout lists
- notification expiry lists with per-item pause/cancel
- dashboards where many items need independent timer lifecycle state

It should not be required for simply rendering 30 countdown labels. For that case, use one `useTimer()` as a shared clock and derive each row's remaining time.

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
```

Group item synchronization semantics:

- `items` is a declarative definition list keyed by `id`.
- New IDs are added.
- Removed IDs are cleaned up.
- Existing IDs keep lifecycle state across rerenders.
- Updating `endWhen`, `onEnd`, or `schedules` changes future evaluation without resetting the item.
- To reset a matching item, call `reset(id)` or `restart(id)`.
- Duplicate IDs should throw a predictable error.

Group scheduler semantics:

- A single `useTimerGroup()` instance must use one shared recursive `setTimeout` loop.
- It must not create one timeout loop per item.
- Each item has independent lifecycle state and generation counters.
- `onEnd` fires at most once per item generation.
- `cancel(id)` does not call that item's `onEnd`.
- Removing an item cancels its pending schedules and ignores stale async work.

## Non-Goals

- No date formatting.
- No localization.
- No timezone conversion.
- No `ampm` output.
- No sound/audio integration.
- No data fetching lifecycle.
- No retries, backoff, cache, or request dedupe.
- No raw platform timer handles in the public API.
- No countdown/stopwatch/clock mode enum.
- No compatibility promise with the previous library API.

## Reported Issues This Design Addresses

- Timely user callbacks: `schedules` supports polling or arbitrary side effects.
- Async duplicate `onExpire`: `onEnd` is once-only per generation.
- Restart after expiry: `restart()` creates a new generation and resets end guards.
- Multiple timers: `useTimerGroup()` handles dynamic keyed timers with one scheduler.
- UTC/timezone requests: out of scope; users derive from `new Date(timer.now)` and format themselves.
- Sound intervals: out of scope; use `schedules` to call app-owned audio code.
- Stopwatch start ambiguity: lifecycle controls are explicit; `start`, `resume`, `reset`, and `restart` have separate meanings.
