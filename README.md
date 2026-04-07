# react-timer-hook

A small React hook library for deterministic timer lifecycles.

This package is planned as a replacement for the previous `react-timer-hook` API. It intentionally does not ship formatting, timezone conversion, `ampm` fields, or countdown/stopwatch/clock mode enums. It gives you raw time data and lifecycle controls so your app can decide what the timer means.

## Status

Planning and implementation spec stage. Hook implementation is not present yet.

## Planned Public API

```ts
import { useTimer, useTimerGroup, durationParts } from 'react-timer-hook';
```

V1 should expose only:

- `useTimer()` for one timer lifecycle.
- `useTimerGroup()` for many keyed independent timer lifecycles.
- `durationParts()` as a pure numeric helper.

## Why This Shape

Most timer libraries mix three concerns:

- scheduling
- lifecycle state
- presentation formatting

This library should only own scheduling and lifecycle mechanics.

Consumers own:

- countdown math
- stopwatch display
- clock formatting
- timezone and locale behavior
- API polling behavior
- audio or notification side effects

## Single Timer

```tsx
function Stopwatch() {
  const timer = useTimer({
    autoStart: false,
    updateIntervalMs: 100,
  });

  return (
    <>
      <span>{Math.floor(timer.elapsedMilliseconds / 1000)}s</span>
      <button onClick={timer.start}>Start</button>
      <button onClick={timer.pause}>Pause</button>
      <button onClick={timer.resume}>Resume</button>
      <button onClick={timer.restart}>Restart</button>
      <button onClick={() => timer.reset()}>Reset</button>
    </>
  );
}
```

## Absolute Deadline Countdown

Use this for auctions, server deadlines, reservations, or any timer where the end timestamp comes from outside the UI.

```tsx
function AuctionTimer({ auctionId, expiresAt }: {
  auctionId: string;
  expiresAt: number;
}) {
  const timer = useTimer({
    autoStart: true,
    updateIntervalMs: 1000,
    endWhen: snapshot => snapshot.now >= expiresAt,
    onEnd: () => api.closeAuction(auctionId),
  });

  const remainingMs = Math.max(0, expiresAt - timer.now);

  if (timer.isEnded) {
    return <span>Auction ended</span>;
  }

  return <span>{Math.ceil(remainingMs / 1000)}s left</span>;
}
```

For absolute deadlines, `pause()` pauses the local timer lifecycle and schedules, but it does not change the external server deadline. On `resume()`, the next `now` value catches up to wall time.

## Pausable Duration Countdown

Use this when pausing should freeze the remaining duration.

```tsx
function BreakTimer() {
  const durationMs = 5 * 60 * 1000;

  const timer = useTimer({
    autoStart: true,
    updateIntervalMs: 1000,
    endWhen: snapshot => snapshot.elapsedMilliseconds >= durationMs,
  });

  const remainingMs = Math.max(0, durationMs - timer.elapsedMilliseconds);

  return <span>{Math.ceil(remainingMs / 1000)}s left</span>;
}
```

## Clock

```tsx
function Clock() {
  const timer = useTimer({
    autoStart: true,
    updateIntervalMs: 1000,
  });

  return <span>{new Date(timer.now).toLocaleTimeString()}</span>;
}
```

The hook does not format time. Use native `Intl`, `Date`, or your preferred date library.

## Schedules and Polling

Schedules are optional side effects that run while a timer is active. They are useful for polling, audio cues, analytics pings, or other app-owned side effects.

```tsx
function AuctionTimer({ auctionId, expiresAt }: Props) {
  const timer = useTimer({
    autoStart: true,
    updateIntervalMs: 1000,
    endWhen: snapshot => snapshot.now >= expiresAt,
    onEnd: () => api.closeAuction(auctionId),
    schedules: [
      {
        id: 'poll-auction',
        everyMs: 5000,
        overlap: 'skip',
        callback: async (_snapshot, controls) => {
          const auction = await api.getAuction(auctionId);

          if (auction.status === 'sold') {
            controls.cancel('sold');
          }
        },
      },
    ],
  });

  if (timer.isCancelled) {
    return <span>Auction closed</span>;
  }

  const remainingMs = Math.max(0, expiresAt - timer.now);
  return <span>{Math.ceil(remainingMs / 1000)}s left</span>;
}
```

`overlap: 'skip'` is the default because it prevents slow async callbacks from piling up.

## Many Independent Timers

For lists where each item has its own pause, resume, cancel, and end lifecycle, use `useTimerGroup`.

```tsx
function AuctionList({ auctions }: { auctions: Auction[] }) {
  const timers = useTimerGroup({
    updateIntervalMs: 1000,
    items: auctions.map(auction => ({
      id: auction.id,
      autoStart: true,
      endWhen: snapshot => snapshot.now >= auction.expiresAt,
      onEnd: () => api.closeAuction(auction.id),
    })),
  });

  return (
    <>
      {auctions.map(auction => {
        const timer = timers.get(auction.id);
        const remainingMs = Math.max(0, auction.expiresAt - (timer?.now ?? timers.now));

        return (
          <AuctionRow
            key={auction.id}
            auction={auction}
            remainingMs={remainingMs}
            isPaused={timer?.isPaused ?? false}
            isEnded={timer?.isEnded ?? false}
            onPause={() => timers.pause(auction.id)}
            onResume={() => timers.resume(auction.id)}
            onCancel={() => timers.cancel(auction.id, 'sold')}
          />
        );
      })}
    </>
  );
}
```

`useTimerGroup()` should use one scheduler internally, not one timeout loop per item.

## Debug Logs

Debug logging is planned for v1, but it is opt-in.

```tsx
const timer = useTimer({
  autoStart: true,
  updateIntervalMs: 1000,
  debug: event => {
    console.debug('[timer]', event);
  },
});
```

No logs should be emitted by default.

Debug events should be semantic, for example `timer:start`, `timer:tick`, `scheduler:start`, `schedule:skip`, and `timer:end`. The library should not expose raw `setTimeout` handles.

## Implementation Notes

- Use recursive `setTimeout`, not `setInterval`.
- Never schedule timers during render.
- Use `Date.now()` for wall-clock `now`.
- Use `performance.now()` internally for active elapsed duration, with a `Date.now()` fallback.
- Keep controls stable for React dependency arrays.
- Keep latest callbacks and options in refs so rerenders do not restart the scheduler unnecessarily.
- Guard async work with generation IDs.
- Clean up on unmount.
- Test with fake timers and React Strict Mode.

See:

- [Requirements](./REQUIREMENTS.md)
- [API Specification](./docs/API.md)
- [Design Decisions](./docs/DECISIONS.md)
- [Recipes](./docs/RECIPES.md)
- [Implementation Plan](./docs/IMPLEMENTATION.md)
- [Task Plan](./docs/TASKS.md)
- [OSS and GTM Plan](./docs/OSS_GTM.md)
- [Release and Docs Plan](./docs/RELEASE_AND_DOCS.md)
- [Agent Task Cards](./docs/AGENT_TASKS.md)
