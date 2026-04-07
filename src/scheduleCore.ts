import { validatePositiveFinite } from './clocks';
import type { TimerControls, TimerSchedule, TimerScheduleContext, TimerSnapshot } from './types';

export type ScheduleState = {
  lastRunAt: number | null;
  pendingCount: number;
  leadingGeneration: number | null;
  signature: string;
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
  onError?(error: unknown, snapshot: TimerSnapshot, controls: TControls, context: TimerScheduleContext): void;
  onEvent?(event: ScheduleEvent): void;
};

export function createScheduleState(): ScheduleState {
  return {
    lastRunAt: null,
    pendingCount: 0,
    leadingGeneration: null,
    signature: '',
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
  onError,
  onEvent,
}: EvaluateSchedulesOptions<TControls>): void {
  const liveKeys = new Set<string>();

  schedules.forEach((schedule, index) => {
    const key = getScheduleKey(schedule, index);
    liveKeys.add(key);
    let state = states.get(key);
    if (!state) {
      state = createScheduleState();
      state.signature = getSingleScheduleSignature(schedule, index);
      states.set(key, state);
    }

    if (activation && schedule.leading && state.leadingGeneration !== generation) {
      state.leadingGeneration = generation;
      runSchedule(schedule, key, state, snapshot, generation, controls, createScheduleContext(schedule, key, snapshot.now, snapshot.now, 0), isLive, onError, onEvent);
      return;
    }

    if (state.lastRunAt === null) {
      state.lastRunAt = snapshot.now;
    }

    const dueCount = Math.floor((snapshot.now - state.lastRunAt) / schedule.everyMs);
    if (dueCount >= 1) {
      const scheduledAt = state.lastRunAt + dueCount * schedule.everyMs;
      runSchedule(schedule, key, state, snapshot, generation, controls, createScheduleContext(schedule, key, scheduledAt, snapshot.now, dueCount - 1), isLive, onError, onEvent);
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
    const key = getScheduleKey(schedule, index);
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
    const key = getScheduleKey(schedule, index);
    const signature = getSingleScheduleSignature(schedule, index);
    liveKeys.add(key);
    const state = states.get(key);
    if (!state) {
      const nextState = createScheduleState();
      nextState.lastRunAt = running ? now : null;
      nextState.signature = signature;
      states.set(key, nextState);
    } else if (state.signature !== signature) {
      state.lastRunAt = running ? now : null;
      state.leadingGeneration = null;
      state.signature = signature;
    }
  });

  for (const key of states.keys()) {
    if (!liveKeys.has(key)) states.delete(key);
  }
}

export function getScheduleSignature(schedules: TimerSchedule[] | undefined): string {
  return JSON.stringify((schedules ?? []).map((schedule, index) => getSingleScheduleSignature(schedule, index)));
}

export function validateSchedules(schedules: TimerSchedule[] | undefined): void {
  const keys = new Set<string>();
  schedules?.forEach((schedule, index) => {
    validatePositiveFinite(schedule.everyMs, 'schedule.everyMs');
    const key = getScheduleKey(schedule, index);
    if (keys.has(key)) throw new Error(`Duplicate schedule id "${key}"`);
    keys.add(key);
  });
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
  onError: ((error: unknown, snapshot: TimerSnapshot, controls: TControls, context: TimerScheduleContext) => void) | undefined,
  onEvent: ((event: ScheduleEvent) => void) | undefined,
): void {
  if (state.pendingCount > 0 && (schedule.overlap ?? 'skip') === 'skip') {
    state.lastRunAt = context.scheduledAt;
    emitIfLive(isLive, generation, onEvent, { type: 'schedule:skip', context, reason: 'overlap' });
    return;
  }

  state.lastRunAt = context.scheduledAt;
  state.pendingCount += 1;
  emitIfLive(isLive, generation, onEvent, { type: 'schedule:start', context });

  Promise.resolve()
    .then(() => schedule.callback(snapshot, controls, context))
    .then(
      () => emitIfLive(isLive, generation, onEvent, { type: 'schedule:end', context }),
      error => {
        if (isLive(generation)) {
          try {
            if (schedule.onError) {
              schedule.onError(error, snapshot, controls, context);
            } else {
              onError?.(error, snapshot, controls, context);
            }
          } finally {
            onEvent?.({ type: 'schedule:error', context, error });
          }
        }
      },
    )
    .finally(() => {
      if (isLive(generation)) {
        state.pendingCount = Math.max(0, state.pendingCount - 1);
      }
    });
}

function getScheduleKey(schedule: TimerSchedule, index: number): string {
  return schedule.id ?? String(index);
}

function getSingleScheduleSignature(schedule: TimerSchedule, index: number): string {
  return JSON.stringify([schedule.id ?? index, schedule.everyMs, schedule.leading ?? false, schedule.overlap ?? 'skip']);
}

function emitIfLive(
  isLive: (generation: number) => boolean,
  generation: number,
  onEvent: ((event: ScheduleEvent) => void) | undefined,
  event: ScheduleEvent,
): void {
  if (isLive(generation)) onEvent?.(event);
}
