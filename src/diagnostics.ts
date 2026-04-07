import type { TimerDebug, TimerDebugEvent } from './types';

export function consoleTimerDiagnostics(options: { includeTicks?: boolean; label?: string } = {}): TimerDebug {
  return {
    ...options,
    logger: (event: TimerDebugEvent) => console.debug('[timer]', event),
  };
}

export type { TimerDebug, TimerDebugEvent, TimerDebugLogger } from './types';
