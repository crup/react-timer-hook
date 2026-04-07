import type { TimerDiagnostics, TimerDiagnosticsEvent } from './types';

export function consoleTimerDiagnostics(options: { includeTicks?: boolean; label?: string } = {}): TimerDiagnostics {
  return {
    ...options,
    logger: (event: TimerDiagnosticsEvent) => console.debug('[timer]', event),
  };
}

export type { TimerDiagnostics, TimerDiagnosticsEvent, TimerDiagnosticsLogger } from './types';
