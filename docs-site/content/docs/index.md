---
title: Deterministic React timers
description: A small React hook library for clocks, countdowns, stopwatches, polling schedules, and many independent timer lifecycles.
template: splash
hero:
  tagline: React timer primitives that stay predictable under rerenders, Strict Mode, async callbacks, and large timer lists.
  actions:
    - text: Get started
      link: /react-timer-hook/getting-started/
      icon: right-arrow
    - text: View on GitHub
      link: https://github.com/crup/react-timer-hook
      variant: minimal
---

`@crup/react-timer-hook` gives React apps a deterministic timer lifecycle instead of a formatting-heavy timer component.

## Why it exists

- One primitive works for countdowns, stopwatches, clocks, and polling.
- `useTimerGroup()` handles many independent timers through one shared scheduler.
- Schedules default to `overlap: 'skip'`, so slow async callbacks do not stack.
- Debug logs are opt-in and semantic. No raw timeout handles leak into your app.
- Formatting, time zones, and business rules stay in userland.

## Install alpha

```sh
npm install @crup/react-timer-hook@alpha
pnpm add @crup/react-timer-hook@alpha
```

## Minimal example

```tsx
import { useTimer } from '@crup/react-timer-hook';

export function Clock() {
  const timer = useTimer({ autoStart: true, updateIntervalMs: 1000 });

  return <time>{new Date(timer.now).toLocaleTimeString()}</time>;
}
```

## Production bar

The public API is intentionally small:

- `useTimer()` for one lifecycle
- `useTimerGroup()` for many keyed lifecycles
- `durationParts()` for display-friendly duration math

The library owns scheduling and cleanup. Your app owns meaning and presentation.
