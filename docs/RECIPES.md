# Recipes

These examples show how consumers should derive common timer behaviors from the primitive API.

The library should not add special modes for these recipes.

## Stopwatch

```tsx
function Stopwatch() {
  const timer = useTimer({
    updateIntervalMs: 100,
  });

  return (
    <>
      <output>{Math.floor(timer.elapsedMilliseconds / 1000)}s</output>
      <button onClick={timer.start}>Start</button>
      <button onClick={timer.pause}>Pause</button>
      <button onClick={timer.resume}>Resume</button>
      <button onClick={timer.restart}>Restart</button>
      <button onClick={() => timer.reset()}>Reset</button>
    </>
  );
}
```

Why this works:

- Stopwatch display is just active elapsed duration.
- Paused time is excluded by the hook.

## Pausable Duration Countdown

```tsx
function PausableCountdown({ durationMs }: { durationMs: number }) {
  const timer = useTimer({
    autoStart: true,
    updateIntervalMs: 1000,
    endWhen: snapshot => snapshot.elapsedMilliseconds >= durationMs,
  });

  const remainingMs = Math.max(0, durationMs - timer.elapsedMilliseconds);

  return (
    <>
      <output>{Math.ceil(remainingMs / 1000)}s</output>
      <button onClick={timer.pause}>Pause</button>
      <button onClick={timer.resume}>Resume</button>
      <button onClick={timer.restart}>Restart</button>
    </>
  );
}
```

Use this when pausing should freeze remaining time.

## Absolute Deadline Countdown

```tsx
function DeadlineCountdown({ expiresAt }: { expiresAt: number }) {
  const timer = useTimer({
    autoStart: true,
    updateIntervalMs: 1000,
    endWhen: snapshot => snapshot.now >= expiresAt,
  });

  const remainingMs = Math.max(0, expiresAt - timer.now);

  return <output>{Math.ceil(remainingMs / 1000)}s</output>;
}
```

Use this for server-owned deadlines.

Important:

- Pausing the local timer does not extend the server deadline.
- On resume, `timer.now` catches up to wall-clock time.

## Clock

```tsx
function Clock() {
  const timer = useTimer({
    autoStart: true,
    updateIntervalMs: 1000,
  });

  return <output>{new Date(timer.now).toLocaleTimeString()}</output>;
}
```

The library does not format the clock. The consumer chooses locale, timezone, and display.

## API Polling Until Cancelled

```tsx
function AuctionTimer({ auctionId, expiresAt }: Props) {
  const timer = useTimer({
    autoStart: true,
    updateIntervalMs: 1000,
    endWhen: snapshot => snapshot.now >= expiresAt,
    onEnd: () => api.closeAuction(auctionId),
    schedules: [
      {
        id: 'auction-poll',
        everyMs: 5000,
        overlap: 'skip',
        callback: async (_snapshot, controls) => {
          const auction = await api.getAuction(auctionId);

          if (auction.status === 'sold') {
            controls.cancel('sold');
          }

          if (auction.status === 'cancelled') {
            controls.cancel('cancelled');
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

The schedule owns only cadence. The app owns API behavior.

## External Event Cancels Timer

```tsx
function AuctionTimer({ auctionId, expiresAt }: Props) {
  const timer = useTimer({
    autoStart: true,
    updateIntervalMs: 1000,
    endWhen: snapshot => snapshot.now >= expiresAt,
  });

  useEffect(() => {
    return subscribeToAuction(auctionId, event => {
      if (event.type === 'auction:sold') {
        timer.cancel('sold');
      }
    });
  }, [auctionId, timer.cancel]);

  const remainingMs = Math.max(0, expiresAt - timer.now);
  return <span>{Math.ceil(remainingMs / 1000)}s left</span>;
}
```

Controls should be stable so this dependency array is safe.

## Many Labels With One Timer

If each row only needs a displayed countdown, use one timer.

```tsx
function AuctionList({ auctions }: { auctions: Auction[] }) {
  const timer = useTimer({
    autoStart: true,
    updateIntervalMs: 1000,
  });

  return (
    <>
      {auctions.map(auction => {
        const remainingMs = Math.max(0, auction.expiresAt - timer.now);

        return (
          <AuctionRow
            key={auction.id}
            auction={auction}
            remainingMs={remainingMs}
          />
        );
      })}
    </>
  );
}
```

Do not use `useTimerGroup` if rows do not have independent lifecycle.

## Many Independent Timers

Use `useTimerGroup` when each item can pause, resume, cancel, or end independently.

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
        const now = timer?.now ?? timers.now;
        const remainingMs = Math.max(0, auction.expiresAt - now);

        return (
          <AuctionRow
            key={auction.id}
            auction={auction}
            remainingMs={remainingMs}
            isPaused={timer?.isPaused ?? false}
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

`useTimerGroup` should still use one shared scheduler internally.

## Debug Logger

```tsx
function DebuggedTimer() {
  const timer = useTimer({
    autoStart: true,
    updateIntervalMs: 1000,
    debug: {
      label: 'checkout-hold',
      includeTicks: false,
      logger: event => {
        console.debug('[timer]', event);
      },
    },
  });

  return <span>{timer.status}</span>;
}
```

Use debug logs to understand lifecycle behavior. Do not use them to drive UI state.
