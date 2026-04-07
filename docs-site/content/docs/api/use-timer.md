---
title: useTimer
description: API reference for a single deterministic timer lifecycle.
---

`useTimer()` manages one timer lifecycle.

```ts
function useTimer(options?: UseTimerOptions): TimerSnapshot & TimerControls;
```

## Options

```ts
type UseTimerOptions = {
  autoStart?: boolean;
  updateIntervalMs?: number;
  endWhen?: (snapshot: TimerSnapshot) => boolean;
  onEnd?: (snapshot: TimerSnapshot, controls: TimerControls) => void | Promise<void>;
  schedules?: TimerSchedule[];
  debug?: TimerDebug;
};
```

### `autoStart`

Starts the timer on mount when the timer is idle.

```ts
useTimer({ autoStart: true });
```

### `updateIntervalMs`

Controls how often React state refreshes while the timer is running. Defaults to `1000`.

```ts
useTimer({ autoStart: true, updateIntervalMs: 250 });
```

The interval must be a positive finite number.

### `endWhen`

Ends the timer when the predicate returns `true`.

```tsx
const expiresAt = Date.now() + 30_000;

const timer = useTimer({
  autoStart: true,
  endWhen: snapshot => snapshot.now >= expiresAt,
});
```

### `onEnd`

Called once per timer generation after `endWhen` becomes true.

```tsx
useTimer({
  autoStart: true,
  endWhen: snapshot => snapshot.elapsedMilliseconds >= 10_000,
  onEnd: async snapshot => {
    await api.markDone(snapshot.endedAt);
  },
});
```

`restart()` starts a new generation, so `onEnd` can fire again for that new run.

### `schedules`

Schedules run side effects while the timer is active.

```tsx
useTimer({
  autoStart: true,
  schedules: [
    {
      id: 'poll-auction',
      everyMs: 5000,
      overlap: 'skip',
      callback: async (_snapshot, controls) => {
        const auction = await api.getAuction();
        if (auction.status === 'sold') controls.cancel('sold');
      },
    },
  ],
});
```

## Controls

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

`start()` is idempotent when already running.

`pause()` freezes the lifecycle and schedules.

`resume()` continues from the paused elapsed duration.

`reset()` returns to idle with zero elapsed time.

`restart()` returns to running with zero elapsed time and a new generation.

`cancel(reason)` is a terminal early stop and does not call `onEnd`.

## Snapshot

```ts
type TimerSnapshot = {
  status: 'idle' | 'running' | 'paused' | 'ended' | 'cancelled';
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

Use `now` for wall-clock math. Use `elapsedMilliseconds` for monotonic active time.
