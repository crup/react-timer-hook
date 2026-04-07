---
title: Countdowns
description: Build absolute and pausable countdowns without timer mode enums.
---

## Absolute deadline

Use `now` when the deadline comes from a server or another wall-clock source.

```tsx
function ReservationHold({ expiresAt }) {
  const timer = useTimer({
    autoStart: true,
    updateIntervalMs: 1000,
    endWhen: snapshot => snapshot.now >= expiresAt,
  });

  const remainingMs = Math.max(0, expiresAt - timer.now);
  return <span>{Math.ceil(remainingMs / 1000)}s left</span>;
}
```

## Pausable duration

Use `elapsedMilliseconds` when pause and resume should freeze the remaining duration.

```tsx
function PomodoroBreak() {
  const durationMs = 5 * 60 * 1000;
  const timer = useTimer({
    autoStart: true,
    updateIntervalMs: 1000,
    endWhen: snapshot => snapshot.elapsedMilliseconds >= durationMs,
  });

  const remainingMs = Math.max(0, durationMs - timer.elapsedMilliseconds);
  return <span>{durationParts(remainingMs).minutes}m left</span>;
}
```

## Early cancellation

```tsx
if (auction.status === 'sold') {
  timer.cancel('sold');
}
```

Cancellation is terminal and does not call `onEnd`.
