import type { TimerControls, TimerSchedule, TimerScheduleContext, TimerSnapshot } from './types';

export type ScheduleState = {
  lastRunAt: number | null;
  pendingCount: number;
  leadingGeneration: number | null;
};

export type ScheduleEvent =
  | { type: 'schedule:start'; context: TimerScheduleContext }
  | { type: 'schedule:skip'; context: TimerScheduleContext; reason: 'overlap' }
  | { type: 'schedule:end'; context: TimerScheduleContext }
  | { type: 'schedule:error'; context: TimerScheduleContext; error: unknown };

export type EvaluateSchedulesOptions<TControls extends TimerControls> = {
  schedules: TimerSchedule[] | undefined;
  states: Map<string, ScheduleState>;
  snapshot: TimerSnapshot;
  generation: number;
  controls: TControls;
  activation?: boolean;
  isLive(generation: number): boolean;
  onEvent?(event: ScheduleEvent): void;
};

export function createScheduleState(): ScheduleState {
  return {
    lastRunAt: null,
    pendingCount: 0,
    leadingGeneration: null,
  };
}

export function evaluateSchedules<TControls extends TimerControls>({
  schedules = [],
  states,
  snapshot,
  generation,
  controls,
  activation = false,
  isLive,
  onEvent,
}: EvaluateSchedulesOptions<TControls>): void {
  const liveKeys = new Set<string>();

  schedules.forEach((schedule, index) => {
    const key = schedule.id ?? String(index);
    liveKeys.add(key);
    let state = states.get(key);
    if (!state) {
      state = createScheduleState();
      states.set(key, state);
    }

    if (activation && schedule.leading && state.leadingGeneration !== generation) {
      state.leadingGeneration = generation;
      runSchedule(schedule, key, state, snapshot, generation, controls, createScheduleContext(schedule, key, snapshot.now, snapshot.now, 0), isLive, onEvent);
      return;
    }

    if (state.lastRunAt === null) {
      state.lastRunAt = snapshot.now;
    }

    const dueCount = Math.floor((snapshot.now - state.lastRunAt) / schedule.everyMs);
    if (dueCount >= 1) {
      const scheduledAt = state.lastRunAt + dueCount * schedule.everyMs;
      runSchedule(schedule, key, state, snapshot, generation, controls, createScheduleContext(schedule, key, scheduledAt, snapshot.now, dueCount - 1), isLive, onEvent);
    }
  });

  for (const key of states.keys()) {
    if (!liveKeys.has(key)) states.delete(key);
  }
}

export function getNextScheduleDelay(
  schedules: TimerSchedule[] | undefined,
  states: Map<string, ScheduleState>,
  now: number,
  fallbackMs: number,
): number {
  let nextDelay = fallbackMs;

  schedules?.forEach((schedule, index) => {
    const key = schedule.id ?? String(index);
    const state = states.get(key);
    const lastRunAt = state?.lastRunAt ?? now;
    nextDelay = Math.min(nextDelay, Math.max(1, lastRunAt + schedule.everyMs - now));
  });

  return nextDelay;
}

export function syncScheduleStates(
  schedules: TimerSchedule[] | undefined,
  states: Map<string, ScheduleState>,
  now: number,
  running: boolean,
): void {
  const liveKeys = new Set<string>();
  schedules?.forEach((schedule, index) => {
    const key = schedule.id ?? String(index);
    liveKeys.add(key);
    if (!states.has(key)) {
      states.set(key, {
        lastRunAt: running ? now : null,
        pendingCount: 0,
        leadingGeneration: null,
      });
    }
  });

  for (const key of states.keys()) {
    if (!liveKeys.has(key)) states.delete(key);
  }
}

export function getScheduleSignature(schedules: TimerSchedule[] | undefined): string {
  return (schedules ?? [])
    .map((schedule, index) => `${schedule.id ?? index}:${schedule.everyMs}:${schedule.leading ?? false}:${schedule.overlap ?? 'skip'}`)
    .join(',');
}

export function createScheduleContext(
  schedule: TimerSchedule,
  key: string,
  scheduledAt: number,
  firedAt: number,
  overdueCount: number,
): TimerScheduleContext {
  return {
    scheduleId: schedule.id ?? key,
    scheduledAt,
    firedAt,
    nextRunAt: scheduledAt + schedule.everyMs,
    overdueCount,
    effectiveEveryMs: schedule.everyMs,
  };
}

function runSchedule<TControls extends TimerControls>(
  schedule: TimerSchedule,
  key: string,
  state: ScheduleState,
  snapshot: TimerSnapshot,
  generation: number,
  controls: TControls,
  context: TimerScheduleContext,
  isLive: (generation: number) => boolean,
  onEvent: ((event: ScheduleEvent) => void) | undefined,
): void {
  if (state.pendingCount > 0 && (schedule.overlap ?? 'skip') === 'skip') {
    state.lastRunAt = context.scheduledAt;
    onEvent?.({ type: 'schedule:skip', context, reason: 'overlap' });
    return;
  }

  state.lastRunAt = context.scheduledAt;
  state.pendingCount += 1;
  onEvent?.({ type: 'schedule:start', context });

  Promise.resolve()
    .then(() => schedule.callback(snapshot, controls, context))
    .then(
      () => onEvent?.({ type: 'schedule:end', context }),
      error => onEvent?.({ type: 'schedule:error', context, error }),
    )
    .finally(() => {
      if (isLive(generation)) {
        state.pendingCount = Math.max(0, state.pendingCount - 1);
      }
    });
}
