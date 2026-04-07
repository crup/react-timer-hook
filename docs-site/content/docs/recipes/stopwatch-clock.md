---
title: Stopwatch and clock
description: Use the same primitive for active elapsed time and wall-clock display.
---

## Stopwatch

```tsx
function Stopwatch() {
  const timer = useTimer({ updateIntervalMs: 100 });

  return (
    <>
      <output>{Math.floor(timer.elapsedMilliseconds / 1000)}s</output>
      <button onClick={timer.start}>Start</button>
      <button onClick={timer.pause}>Pause</button>
      <button onClick={timer.resume}>Resume</button>
      <button onClick={timer.restart}>Restart</button>
    </>
  );
}
```

## Clock

```tsx
function Clock() {
  const timer = useTimer({ autoStart: true, updateIntervalMs: 1000 });

  return <time>{new Date(timer.now).toLocaleTimeString()}</time>;
}
```

The library does not format time. Use `Intl`, `Date`, or your preferred date library.
