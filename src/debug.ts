import type { TimerDebug, TimerDebugEvent, TimerDebugLogger, TimerSnapshot } from './types';

type DebugConfig = {
  enabled: boolean;
  includeTicks: boolean;
  label?: string;
  logger?: TimerDebugLogger;
};

export function resolveDebug(debug: TimerDebug | undefined): DebugConfig {
  if (!debug) return { enabled: false, includeTicks: false };
  if (debug === true) return { enabled: true, includeTicks: false, logger: console.debug };
  if (typeof debug === 'function') return { enabled: true, includeTicks: false, logger: debug };

  return {
    enabled: debug.enabled !== false,
    includeTicks: debug.includeTicks ?? false,
    label: debug.label,
    logger: debug.logger ?? console.debug,
  };
}

export function emitDebug(
  debug: TimerDebug | undefined,
  event: Omit<TimerDebugEvent, 'label'> & { label?: string },
): void {
  const config = resolveDebug(debug);
  if (!config.enabled || !config.logger) return;
  if (event.type === 'timer:tick' && !config.includeTicks) return;

  config.logger({
    ...event,
    label: event.label ?? config.label,
  });
}

export function baseDebugEvent(
  snapshot: TimerSnapshot,
  generation: number,
): Pick<TimerDebugEvent, 'generation' | 'tick' | 'now' | 'elapsedMilliseconds' | 'status'> {
  return {
    generation,
    tick: snapshot.tick,
    now: snapshot.now,
    elapsedMilliseconds: snapshot.elapsedMilliseconds,
    status: snapshot.status,
  };
}
