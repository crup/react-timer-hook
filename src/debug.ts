import type { TimerDiagnostics, TimerDiagnosticsEvent, TimerDiagnosticsLogger, TimerSnapshot } from './types';

type DebugConfig = {
  enabled: boolean;
  includeTicks: boolean;
  label?: string;
  logger?: TimerDiagnosticsLogger;
};

export function resolveDiagnostics(diagnostics: TimerDiagnostics | undefined): DebugConfig {
  if (!diagnostics) return { enabled: false, includeTicks: false };
  if (typeof diagnostics === 'function') return { enabled: true, includeTicks: false, logger: diagnostics };

  return {
    enabled: diagnostics.enabled !== false,
    includeTicks: diagnostics.includeTicks ?? false,
    label: diagnostics.label,
    logger: diagnostics.logger,
  };
}

export function emitDiagnostics(
  diagnostics: TimerDiagnostics | undefined,
  event: Omit<TimerDiagnosticsEvent, 'label'> & { label?: string },
): void {
  const config = resolveDiagnostics(diagnostics);
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
): Pick<TimerDiagnosticsEvent, 'generation' | 'tick' | 'now' | 'elapsedMilliseconds' | 'status'> {
  return {
    generation,
    tick: snapshot.tick,
    now: snapshot.now,
    elapsedMilliseconds: snapshot.elapsedMilliseconds,
    status: snapshot.status,
  };
}
