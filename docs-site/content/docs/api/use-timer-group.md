---
title: useTimerGroup
description: API reference for many keyed independent timer lifecycles driven by one scheduler.
---

`useTimerGroup()` manages many keyed timer lifecycles through one shared scheduler.

```ts
function useTimerGroup(options?: UseTimerGroupOptions): TimerGroupResult;
```

## Options

```ts
type UseTimerGroupOptions = {
  updateIntervalMs?: number;
  items?: TimerGroupItem[];
  debug?: TimerDebug;
};

type TimerGroupItem = {
  id: string;
  autoStart?: boolean;
  endWhen?: (snapshot: TimerSnapshot) => boolean;
  onEnd?: (snapshot: TimerSnapshot, controls: TimerGroupItemControls) => void | Promise<void>;
  schedules?: TimerSchedule[];
};
```

`id` must be unique inside the group.

## Result

```ts
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

## Auction list

```tsx
import { useTimerGroup } from '@crup/react-timer-hook';

export function AuctionList({ auctions }) {
  const timers = useTimerGroup({
    updateIntervalMs: 1000,
    items: auctions.map(auction => ({
      id: auction.id,
      autoStart: true,
      endWhen: snapshot => snapshot.now >= auction.expiresAt,
      onEnd: () => api.closeAuction(auction.id),
    })),
  });

  return auctions.map(auction => {
    const timer = timers.get(auction.id);
    const remainingMs = Math.max(0, auction.expiresAt - (timer?.now ?? timers.now));

    return (
      <AuctionRow
        key={auction.id}
        remainingMs={remainingMs}
        onPause={() => timers.pause(auction.id)}
        onResume={() => timers.resume(auction.id)}
        onCancel={() => timers.cancel(auction.id, 'sold')}
      />
    );
  });
}
```

Use a single `useTimer()` when a list only needs display countdowns. Use `useTimerGroup()` when each row needs its own lifecycle.
