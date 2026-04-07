# @crup/react-timer-hook

> ~1.2 kB timer core for React, with opt-in batteries for schedules, diagnostics, duration math, and many independent timers.

[![npm alpha](https://img.shields.io/npm/v/%40crup%2Freact-timer-hook/alpha?label=npm%20alpha&color=00b894)](https://www.npmjs.com/package/@crup/react-timer-hook?activeTab=versions)
[![npm downloads](https://img.shields.io/npm/dm/%40crup%2Freact-timer-hook?color=0f766e)](https://www.npmjs.com/package/@crup/react-timer-hook)
[![CI](https://github.com/crup/react-timer-hook/actions/workflows/ci.yml/badge.svg)](https://github.com/crup/react-timer-hook/actions/workflows/ci.yml)
[![Docs](https://github.com/crup/react-timer-hook/actions/workflows/docs.yml/badge.svg)](https://github.com/crup/react-timer-hook/actions/workflows/docs.yml)
[![Size](https://github.com/crup/react-timer-hook/actions/workflows/size.yml/badge.svg)](https://github.com/crup/react-timer-hook/actions/workflows/size.yml)
[![license](https://img.shields.io/npm/l/%40crup%2Freact-timer-hook?color=111827)](./LICENSE)
[![types](https://img.shields.io/npm/types/%40crup%2Freact-timer-hook?color=2563eb)](https://www.npmjs.com/package/@crup/react-timer-hook)
[![React](https://img.shields.io/npm/dependency-version/%40crup%2Freact-timer-hook/peer/react?label=react&color=149eca)](https://react.dev/)

📚 Docs and live examples: https://crup.github.io/react-timer-hook/

## Why this exists

Timer hooks look simple until real apps need pause/resume semantics, Strict Mode cleanup, async callbacks, polling that does not overlap, and lists with dozens of independent timers.

`@crup/react-timer-hook` starts with a tiny core and lets your app compose the heavier pieces only when it needs them:

- ⏱️ `useTimer()` from the root package for one lifecycle: stopwatch, countdown, clock, or custom flow.
- 🔋 Batteries are optional: schedules, timer groups, duration helpers, and diagnostics live in subpath imports.
- 🧭 `useTimerGroup()` from `/group` for many keyed lifecycles with one shared scheduler.
- 📡 `useScheduledTimer()` from `/schedules` for polling, overdue timing context, and opt-in diagnostics.
- 🧩 `durationParts()` from `/duration` for display math without locale or timezone opinions.
- 🧼 No formatting, timezone, audio, retry, cache, or data-fetching policy baked in.
- 🧪 Built for rerenders, Strict Mode, async callbacks, cleanup, and many timers.
- 🤖 Agent-friendly docs through hosted `llms.txt`, `llms-full.txt`, and an optional MCP docs helper.

## Install

The project is currently in alpha while the API receives feedback.

```sh
npm install @crup/react-timer-hook@alpha
pnpm add @crup/react-timer-hook@alpha
```

```tsx
import { useTimer } from '@crup/react-timer-hook';
import { durationParts } from '@crup/react-timer-hook/duration';
import { useTimerGroup } from '@crup/react-timer-hook/group';
import { useScheduledTimer } from '@crup/react-timer-hook/schedules';
```

## Live recipes

Each recipe has a live playground and a focused code sample:

- Basic: [wall clock](https://crup.github.io/react-timer-hook/recipes/basic/wall-clock/), [stopwatch](https://crup.github.io/react-timer-hook/recipes/basic/stopwatch/), [absolute countdown](https://crup.github.io/react-timer-hook/recipes/basic/absolute-countdown/), [pausable countdown](https://crup.github.io/react-timer-hook/recipes/basic/pausable-countdown/), [manual controls](https://crup.github.io/react-timer-hook/recipes/basic/manual-controls/)
- Intermediate: [once-only onEnd](https://crup.github.io/react-timer-hook/recipes/intermediate/once-only-on-end/), [polling schedule](https://crup.github.io/react-timer-hook/recipes/intermediate/polling-schedule/), [poll and cancel](https://crup.github.io/react-timer-hook/recipes/intermediate/poll-and-cancel/), [backend event stop](https://crup.github.io/react-timer-hook/recipes/intermediate/backend-event-stop/), [debug logs](https://crup.github.io/react-timer-hook/recipes/intermediate/debug-logs/)
- Advanced: [many display countdowns](https://crup.github.io/react-timer-hook/recipes/advanced/many-display-countdowns/), [timer group](https://crup.github.io/react-timer-hook/recipes/advanced/timer-group/), [group controls](https://crup.github.io/react-timer-hook/recipes/advanced/group-controls/), [per-item polling](https://crup.github.io/react-timer-hook/recipes/advanced/per-item-polling/), [dynamic items](https://crup.github.io/react-timer-hook/recipes/advanced/dynamic-items/)

## Quick examples

### Stopwatch

```tsx
import { useTimer } from '@crup/react-timer-hook';

export function Stopwatch() {
  const timer = useTimer({ updateIntervalMs: 100 });

  return (
    <>
      <output>{(timer.elapsedMilliseconds / 1000).toFixed(1)}s</output>
      <button disabled={!timer.isIdle} onClick={timer.start}>Start</button>
      <button disabled={!timer.isRunning} onClick={timer.pause}>Pause</button>
      <button disabled={!timer.isPaused} onClick={timer.resume}>Resume</button>
      <button onClick={timer.restart}>Restart</button>
    </>
  );
}
```

### Auction countdown

Use `now` for wall-clock deadlines from a server, auction, reservation, or job expiry.

```tsx
import { useTimer } from '@crup/react-timer-hook';

export function AuctionTimer({ auctionId, expiresAt }: {
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

  if (timer.isEnded) return <span>Auction ended</span>;
  return <span>{Math.ceil(remainingMs / 1000)}s left</span>;
}
```

### Poll and cancel early

Schedules run while the timer is active. Slow async work is skipped by default with `overlap: 'skip'`.

```tsx
import { useScheduledTimer } from '@crup/react-timer-hook/schedules';

const timer = useScheduledTimer({
  autoStart: true,
  updateIntervalMs: 1000,
  endWhen: snapshot => snapshot.now >= expiresAt,
  schedules: [
    {
      id: 'auction-poll',
      everyMs: 5000,
      overlap: 'skip',
      callback: async (_snapshot, controls, context) => {
        console.log(`auction poll fired ${context.firedAt - context.scheduledAt}ms late`);
        const auction = await api.getAuction(auctionId);
        if (auction.status === 'sold') controls.cancel('sold');
      },
    },
  ],
});
```

### Many independent timers

Use `useTimerGroup()` when every row needs its own pause, resume, cancel, restart, schedules, or `onEnd`.

```tsx
import { useTimerGroup } from '@crup/react-timer-hook/group';

const timers = useTimerGroup({
  updateIntervalMs: 1000,
  items: auctions.map(auction => ({
    id: auction.id,
    autoStart: true,
    endWhen: snapshot => snapshot.now >= auction.expiresAt,
    onEnd: () => api.closeAuction(auction.id),
  })),
});
```

## API tables

### `useTimer()` settings

| Key | Type | Required | Description |
| --- | --- | --- | --- |
| `autoStart` | `boolean` | No | Starts the lifecycle after mount. Defaults to `false`. |
| `updateIntervalMs` | `number` | No | Render/update cadence in milliseconds. Defaults to `1000`. This does not define elapsed time; elapsed time is calculated from timestamps. Use a smaller value like `100` or `20` when the UI needs finer updates. |
| `endWhen` | `(snapshot) => boolean` | No | Ends the lifecycle when it returns `true`. Use this for countdowns, timeouts, and custom stop conditions. |
| `onEnd` | `(snapshot, controls) => void \| Promise<void>` | No | Called once per generation when `endWhen` ends the lifecycle. `restart()` creates a new generation. |

### `useScheduledTimer()` settings

Import from `@crup/react-timer-hook/schedules` when you need polling or scheduled side effects.

| Key | Type | Required | Description |
| --- | --- | --- | --- |
| `autoStart` | `boolean` | No | Starts the lifecycle after mount. Defaults to `false`. |
| `updateIntervalMs` | `number` | No | Render/update cadence in milliseconds. Defaults to `1000`. Scheduled callbacks can run on their own cadence. |
| `endWhen` | `(snapshot) => boolean` | No | Ends the lifecycle when it returns `true`. |
| `onEnd` | `(snapshot, controls) => void \| Promise<void>` | No | Called once per generation when `endWhen` ends the lifecycle. |
| `schedules` | `TimerSchedule[]` | No | Scheduled side effects that run while the timer is active. Async overlap defaults to `skip`. |
| `debug` | `TimerDebug` | No | Opt-in semantic diagnostics. No logs are emitted by default. |

### `TimerSchedule`

| Key | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | No | Stable identifier used in debug events and schedule context. Falls back to the array index. |
| `everyMs` | `number` | Yes | Schedule cadence in milliseconds. Must be positive and finite. |
| `leading` | `boolean` | No | Runs the schedule immediately when the timer starts or resumes into a new generation. Defaults to `false`. |
| `overlap` | `'skip' \| 'allow'` | No | Controls async overlap. Defaults to `skip`, so a pending callback prevents another run. |
| `callback` | `(snapshot, controls, context) => void \| Promise<void>` | Yes | Scheduled side effect. Receives timing context with `scheduledAt`, `firedAt`, `nextRunAt`, `overdueCount`, and `effectiveEveryMs`. |

### `useTimerGroup()` settings

Import from `@crup/react-timer-hook/group` when many keyed items need independent lifecycle control.

| Key | Type | Required | Description |
| --- | --- | --- | --- |
| `updateIntervalMs` | `number` | No | Shared scheduler cadence for the group. Defaults to `1000`. |
| `items` | `TimerGroupItem[]` | No | Initial/synced timer item definitions. Each item has its own lifecycle state. |
| `debug` | `TimerDebug` | No | Opt-in semantic diagnostics for group lifecycle and schedule events. |

### `TimerGroupItem`

| Key | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes | Stable key for the item. Duplicate IDs throw. |
| `autoStart` | `boolean` | No | Starts the item automatically when it is added or synced. Defaults to `false`. |
| `endWhen` | `(snapshot) => boolean` | No | Ends that item when it returns `true`. |
| `onEnd` | `(snapshot, controls) => void \| Promise<void>` | No | Called once per item generation when that item ends naturally. |
| `schedules` | `TimerSchedule[]` | No | Per-item schedules with the same contract as `useScheduledTimer()`. |

### Values and controls

| Key | Type | Description |
| --- | --- | --- |
| `status` | `'idle' \| 'running' \| 'paused' \| 'ended' \| 'cancelled'` | Current lifecycle state. |
| `now` | `number` | Wall-clock timestamp from `Date.now()`. Use for clocks and absolute deadlines. |
| `tick` | `number` | Number of render/update ticks produced in the current generation. |
| `startedAt` | `number \| null` | Wall-clock timestamp when the current generation started. |
| `pausedAt` | `number \| null` | Wall-clock timestamp for the current pause, or `null`. |
| `endedAt` | `number \| null` | Wall-clock timestamp when `endWhen` ended the lifecycle. |
| `cancelledAt` | `number \| null` | Wall-clock timestamp when `cancel()` ended the lifecycle early. |
| `cancelReason` | `string \| null` | Optional reason passed to `cancel(reason)`. |
| `elapsedMilliseconds` | `number` | Active elapsed duration calculated from monotonic time, excluding paused time. |
| `isIdle` | `boolean` | Convenience flag for `status === 'idle'`. |
| `isRunning` | `boolean` | Convenience flag for `status === 'running'`. |
| `isPaused` | `boolean` | Convenience flag for `status === 'paused'`. |
| `isEnded` | `boolean` | Convenience flag for `status === 'ended'`. |
| `isCancelled` | `boolean` | Convenience flag for `status === 'cancelled'`. |
| `start()` | `function` | Starts an idle timer. No-op if it is already started. |
| `pause()` | `function` | Pauses a running timer. |
| `resume()` | `function` | Resumes a paused timer from the paused elapsed value. |
| `reset(options?)` | `function` | Resets to idle and zero elapsed time. Pass `{ autoStart: true }` to reset directly into running. |
| `restart()` | `function` | Starts a new running generation from zero elapsed time. |
| `cancel(reason?)` | `function` | Terminal early stop. Does not call `onEnd`. |

## Bundle size

The core import stays small. Extra capabilities are opt-in batteries.

| Entry | Raw | Gzip | Brotli |
| --- | ---: | ---: | ---: |
| core | 3.82 kB | 1.31 kB | 1.21 kB |
| timer group add-on | 8.94 kB | 2.97 kB | 2.70 kB |
| schedules add-on | 6.88 kB | 2.32 kB | 2.13 kB |
| duration helper | 318 B | 224 B | 192 B |
| diagnostics helper | 105 B | 115 B | 99 B |

CI writes a size summary to the GitHub Actions UI and posts bundle-size reports on pull requests.

## AI-friendly docs

Agents and docs-aware IDEs can use:

- https://crup.github.io/react-timer-hook/llms.txt
- https://crup.github.io/react-timer-hook/llms-full.txt

Optional local MCP docs server:

```json
{
  "mcpServers": {
    "react-timer-hook-docs": {
      "command": "node",
      "args": ["/absolute/path/to/react-timer-hook/mcp/server.mjs"]
    }
  }
}
```

It exposes:

```txt
react-timer-hook://package
react-timer-hook://api
react-timer-hook://recipes
```

## Contributing

Issues, recipes, docs improvements, and focused bug reports are welcome.

- Read the docs: https://crup.github.io/react-timer-hook/
- Open an issue: https://github.com/crup/react-timer-hook/issues
- See the contributing guide: ./CONTRIBUTING.md

The package targets Node 24 for development and React 18+ as a peer dependency.
