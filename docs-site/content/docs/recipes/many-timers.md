---
title: Many independent timers
description: Use one shared scheduler for lists where every item has its own timer lifecycle.
---

Use `useTimerGroup()` when each row needs independent pause, resume, cancel, restart, schedules, or `onEnd`.

```tsx
function JobList({ jobs }) {
  const timers = useTimerGroup({
    updateIntervalMs: 1000,
    items: jobs.map(job => ({
      id: job.id,
      autoStart: job.status === 'running',
      endWhen: snapshot => snapshot.elapsedMilliseconds >= job.timeoutMs,
      onEnd: () => api.markTimedOut(job.id),
    })),
  });

  return jobs.map(job => {
    const timer = timers.get(job.id);

    return (
      <JobRow
        key={job.id}
        elapsedMs={timer?.elapsedMilliseconds ?? 0}
        onPause={() => timers.pause(job.id)}
        onResume={() => timers.resume(job.id)}
        onCancel={() => timers.cancel(job.id, 'manual')}
      />
    );
  });
}
```

If a list only displays remaining wall-clock time, one `useTimer()` in the parent is usually enough.
