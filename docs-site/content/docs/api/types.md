---
title: Types
description: Public TypeScript types exported by the package.
---

## Duration parts

```ts
type DurationParts = {
  totalMilliseconds: number;
  totalSeconds: number;
  milliseconds: number;
  seconds: number;
  minutes: number;
  hours: number;
  days: number;
};
```

```ts
import { durationParts } from '@crup/react-timer-hook';

const parts = durationParts(90_500);
// { totalSeconds: 90, minutes: 1, seconds: 30, milliseconds: 500, ... }
```

## Schedules

```ts
type TimerSchedule = {
  id?: string;
  everyMs: number;
  leading?: boolean;
  overlap?: 'skip' | 'allow';
  callback: (snapshot: TimerSnapshot, controls: TimerControls) => void | Promise<void>;
};
```

Default overlap behavior is `skip`.

## Debug

```ts
type TimerDebug =
  | boolean
  | TimerDebugLogger
  | {
      enabled?: boolean;
      logger?: TimerDebugLogger;
      includeTicks?: boolean;
      label?: string;
    };

type TimerDebugLogger = (event: TimerDebugEvent) => void;
```

Debug is opt-in. The package does not emit logs by default.
