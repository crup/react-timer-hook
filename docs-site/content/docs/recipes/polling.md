---
title: Polling and schedules
description: Run side effects on a cadence while the timer lifecycle is active.
---

Schedules are for side effects that are owned by your app: polling, sound cues, analytics pings, or background checks.

```tsx
function AuctionTimer({ auctionId, expiresAt }) {
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
          if (auction.status === 'sold') controls.cancel('sold');
        },
      },
    ],
  });

  return <span>{timer.status}</span>;
}
```

`overlap: 'skip'` prevents slow async callbacks from piling up.

Use React Query, SWR, or app code for retries, caching, backoff, and stale-data policy.
