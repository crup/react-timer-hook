export type TimerStatus = 'idle' | 'running' | 'paused' | 'ended' | 'cancelled';

export type DurationParts = {
  totalMilliseconds: number;
  totalSeconds: number;
  milliseconds: number;
  seconds: number;
  minutes: number;
  hours: number;
  days: number;
};

export type TimerSnapshot = {
  status: TimerStatus;
  now: number;
  tick: number;
  startedAt: number | null;
  pausedAt: number | null;
  endedAt: number | null;
  cancelledAt: number | null;
  cancelReason: string | null;
  elapsedMilliseconds: number;
  isIdle: boolean;
  isRunning: boolean;
  isPaused: boolean;
  isEnded: boolean;
  isCancelled: boolean;
};

export type TimerControls = {
  start(): void;
  pause(): void;
  resume(): void;
  reset(options?: { autoStart?: boolean }): void;
  restart(): void;
  cancel(reason?: string): void;
};

export type TimerEndPredicate = (snapshot: TimerSnapshot) => boolean;

export type TimerSchedule = {
  id?: string;
  everyMs: number;
  leading?: boolean;
  overlap?: 'skip' | 'allow';
  callback: (snapshot: TimerSnapshot, controls: TimerControls) => void | Promise<void>;
};

export type TimerDebug =
  | boolean
  | TimerDebugLogger
  | {
      enabled?: boolean;
      logger?: TimerDebugLogger;
      includeTicks?: boolean;
      label?: string;
    };

export type TimerDebugLogger = (event: TimerDebugEvent) => void;

export type TimerDebugEvent = {
  type:
    | 'timer:start'
    | 'timer:pause'
    | 'timer:resume'
    | 'timer:reset'
    | 'timer:restart'
    | 'timer:cancel'
    | 'timer:end'
    | 'timer:tick'
    | 'scheduler:start'
    | 'scheduler:stop'
    | 'schedule:start'
    | 'schedule:skip'
    | 'schedule:end'
    | 'schedule:error'
    | 'callback:error';
  scope: 'timer' | 'timer-group';
  label?: string;
  timerId?: string;
  scheduleId?: string;
  generation: number;
  tick: number;
  now: number;
  elapsedMilliseconds: number;
  status: TimerStatus;
  reason?: string;
  error?: unknown;
};

export type UseTimerOptions = {
  autoStart?: boolean;
  updateIntervalMs?: number;
  endWhen?: TimerEndPredicate;
  onEnd?: (snapshot: TimerSnapshot, controls: TimerControls) => void | Promise<void>;
  schedules?: TimerSchedule[];
  debug?: TimerDebug;
};

export type TimerGroupItemControls = {
  start(): void;
  pause(): void;
  resume(): void;
  reset(options?: { autoStart?: boolean }): void;
  restart(): void;
  cancel(reason?: string): void;
};

export type TimerGroupItem = {
  id: string;
  autoStart?: boolean;
  endWhen?: TimerEndPredicate;
  onEnd?: (snapshot: TimerSnapshot, controls: TimerGroupItemControls) => void | Promise<void>;
  schedules?: TimerSchedule[];
};

export type UseTimerGroupOptions = {
  updateIntervalMs?: number;
  items?: TimerGroupItem[];
  debug?: TimerDebug;
};

export type TimerGroupResult = {
  now: number;
  size: number;
  ids: string[];
  get(id: string): TimerSnapshot | undefined;
  add(item: TimerGroupItem): void;
  update(id: string, item: Partial<Omit<TimerGroupItem, 'id'>>): void;
  remove(id: string): void;
  clear(): void;
  start(id: string): void;
  pause(id: string): void;
  resume(id: string): void;
  reset(id: string, options?: { autoStart?: boolean }): void;
  restart(id: string): void;
  cancel(id: string, reason?: string): void;
  startAll(): void;
  pauseAll(): void;
  resumeAll(): void;
  resetAll(options?: { autoStart?: boolean }): void;
  restartAll(): void;
  cancelAll(reason?: string): void;
};
