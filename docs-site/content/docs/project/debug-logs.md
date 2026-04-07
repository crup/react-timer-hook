---
title: Debug logs
description: Opt-in semantic diagnostics for timer lifecycles and schedules.
---

Debug logs are off by default.

```tsx
useTimer({
  autoStart: true,
  debug: {
    label: 'auction-card',
    includeTicks: false,
    logger: event => console.debug('[timer]', event),
  },
});
```

Debug events are semantic:

- `timer:start`
- `timer:pause`
- `timer:resume`
- `timer:reset`
- `timer:restart`
- `timer:cancel`
- `timer:end`
- `scheduler:start`
- `scheduler:stop`
- `schedule:start`
- `schedule:skip`
- `schedule:end`
- `schedule:error`
- `callback:error`

Raw timeout handles are not exposed.
