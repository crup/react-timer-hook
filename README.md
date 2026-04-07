# @crup/react-timer-hook

> Deterministic React timer primitives for countdowns, stopwatches, clocks, schedules, and many independent timers.

[![npm alpha](https://img.shields.io/npm/v/%40crup%2Freact-timer-hook/alpha?label=npm%20alpha&color=00b894)](https://www.npmjs.com/package/@crup/react-timer-hook?activeTab=versions)
[![npm downloads](https://img.shields.io/npm/dm/%40crup%2Freact-timer-hook?color=0f766e)](https://www.npmjs.com/package/@crup/react-timer-hook)
[![CI](https://github.com/crup/react-timer-hook/actions/workflows/ci.yml/badge.svg)](https://github.com/crup/react-timer-hook/actions/workflows/ci.yml)
[![Docs](https://github.com/crup/react-timer-hook/actions/workflows/docs.yml/badge.svg)](https://github.com/crup/react-timer-hook/actions/workflows/docs.yml)
[![Size](https://github.com/crup/react-timer-hook/actions/workflows/size.yml/badge.svg)](https://github.com/crup/react-timer-hook/actions/workflows/size.yml)
[![license](https://img.shields.io/npm/l/%40crup%2Freact-timer-hook?color=111827)](./LICENSE)
[![types](https://img.shields.io/npm/types/%40crup%2Freact-timer-hook?color=2563eb)](./dist/index.d.ts)

📚 Docs: https://crup.github.io/react-timer-hook/

## Docs and live examples

The documentation site is built with Docusaurus and includes live React playgrounds for 15 recipes:

- Basic: clock, stopwatch, absolute countdown, pausable countdown, manual controls
- Intermediate: once-only `onEnd`, polling, poll-and-cancel, backend events, debug logs
- Advanced: many display timers, timer groups, global controls, per-item polling, dynamic items

Open: https://crup.github.io/react-timer-hook/

## Why it is different

Most timer libraries mix scheduling, lifecycle, formatting, and app behavior. This package keeps the core small:

- ⏱️ `useTimer()` for one lifecycle.
- 🧭 `useTimerGroup()` for many keyed lifecycles with one shared scheduler.
- 🧩 `durationParts()` for display-friendly duration math.
- 🧼 No timezone, locale, or formatting opinions.
- 🧪 Built around React Strict Mode, rerenders, async callbacks, and cleanup.
- 🤖 AI-friendly docs via `llms.txt`, `llms-full.txt`, and a tiny local MCP docs utility.

## Install

Alpha is the only intended release channel until stable publishing is explicitly unlocked.

```sh
npm install @crup/react-timer-hook@alpha
pnpm add @crup/react-timer-hook@alpha
```

```ts
import { durationParts, useTimer, useTimerGroup } from '@crup/react-timer-hook';
```

## Quick examples

### Stopwatch

```tsx
import { useTimer } from '@crup/react-timer-hook';

export function Stopwatch() {
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

### Absolute countdown

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

### Polling with early cancel

Schedules run while the timer is active. Slow async work is skipped by default with `overlap: 'skip'`.

```tsx
const timer = useTimer({
  autoStart: true,
  updateIntervalMs: 1000,
  endWhen: snapshot => snapshot.now >= expiresAt,
  schedules: [
    {
      id: 'auction-poll',
      everyMs: 5000,
      overlap: 'skip',
      callback: async (_snapshot, controls) => {
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

## Bundle size

Current local build:

| File | Raw | Gzip | Brotli |
| --- | ---: | ---: | ---: |
| `dist/index.js` | 27.32 kB | 4.69 kB | 4.18 kB |
| `dist/index.cjs` | 29.18 kB | 5.08 kB | 4.50 kB |
| `dist/index.d.ts` | 3.95 kB | 992 B | 888 B |

CI writes a size summary to the GitHub Actions UI and posts a bundle-size comment on pull requests.

## AI-friendly

End users do not need these files. They are for coding agents, docs-aware IDEs, and MCP clients.

### MCP setup

Clone the repo, install dependencies, and point your MCP client at the local stdio server:

```sh
git clone https://github.com/crup/react-timer-hook.git
cd react-timer-hook
pnpm install
```

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

The MCP server exposes:

```txt
react-timer-hook://package
react-timer-hook://api
react-timer-hook://recipes
```

Agents can use hosted context:

- https://crup.github.io/react-timer-hook/llms.txt
- https://crup.github.io/react-timer-hook/llms-full.txt

Local MCP/docs helpers:

```sh
pnpm ai:context
pnpm mcp:docs
```

The MCP utility is repo-local and excluded from the published npm package.

## Release policy

- Published versions must stay `0.0.1-alpha.x` until stable release is explicitly unlocked.
- `@alpha` is the documented install tag right now.
- Npm requires a `latest` dist-tag, so the workflow keeps `latest` pointing at the current alpha until stable publishing is unlocked.

## Links

- 📚 Docs: https://crup.github.io/react-timer-hook/
- 📦 npm: https://www.npmjs.com/package/@crup/react-timer-hook
- 🧵 Issues: https://github.com/crup/react-timer-hook/issues
- 🤝 Contributing: ./CONTRIBUTING.md
