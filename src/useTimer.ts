import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { baseDebugEvent, emitDebug } from './debug';
import { readClock, validatePositiveFinite } from './clocks';
import {
  cancelTimerState,
  createTimerState,
  endTimerState,
  pauseTimerState,
  resetTimerState,
  restartTimerState,
  resumeTimerState,
  startTimerState,
  tickTimerState,
  toSnapshot,
  type InternalTimerState,
} from './state';
import type { TimerControls, TimerSchedule, TimerSnapshot, UseTimerOptions } from './types';

type ScheduleState = {
  lastRunAt: number | null;
  pending: boolean;
  leadingGeneration: number | null;
};

export function useTimer(options: UseTimerOptions = {}): TimerSnapshot & TimerControls {
  const updateIntervalMs = options.updateIntervalMs ?? 1000;
  validatePositiveFinite(updateIntervalMs, 'updateIntervalMs');
  validateSchedules(options.schedules);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const stateRef = useRef<InternalTimerState | null>(null);
  if (stateRef.current === null) {
    stateRef.current = createTimerState(readClock());
  }

  const mountedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedulesRef = useRef<Map<string, ScheduleState>>(new Map());
  const endCalledGenerationRef = useRef<number | null>(null);
  const [, rerender] = useReducer((value: number) => value + 1, 0);

  const clearScheduledTick = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const getSnapshot = useCallback((clock = readClock()) => {
    return toSnapshot(stateRef.current!, clock);
  }, []);

  const emit = useCallback(
    (type: Parameters<typeof emitDebug>[1]['type'], snapshot: TimerSnapshot, extra: Partial<Parameters<typeof emitDebug>[1]> = {}) => {
      emitDebug(optionsRef.current.debug, {
        type,
        scope: 'timer',
        ...baseDebugEvent(snapshot, stateRef.current!.generation),
        ...extra,
      });
    },
    [],
  );

  const controlsRef = useRef<TimerControls | null>(null);

  const callOnEnd = useCallback(
    (snapshot: TimerSnapshot) => {
      const generation = stateRef.current!.generation;
      if (endCalledGenerationRef.current === generation) return;
      endCalledGenerationRef.current = generation;

      try {
        void optionsRef.current.onEnd?.(snapshot, controlsRef.current!);
      } catch (error) {
        emitDebug(optionsRef.current.debug, {
          type: 'callback:error',
          scope: 'timer',
          ...baseDebugEvent(snapshot, generation),
          error,
        });
      }
    },
    [],
  );

  const runSchedule = useCallback(
    (schedule: TimerSchedule, key: string, scheduleState: ScheduleState, snapshot: TimerSnapshot, generation: number) => {
      if (scheduleState.pending && (schedule.overlap ?? 'skip') === 'skip') {
        emitDebug(optionsRef.current.debug, {
          type: 'schedule:skip',
          scope: 'timer',
          scheduleId: schedule.id ?? key,
          reason: 'overlap',
          ...baseDebugEvent(snapshot, generation),
        });
        return;
      }

      scheduleState.lastRunAt = snapshot.now;
      scheduleState.pending = true;
      emitDebug(optionsRef.current.debug, {
        type: 'schedule:start',
        scope: 'timer',
        scheduleId: schedule.id ?? key,
        ...baseDebugEvent(snapshot, generation),
      });

      Promise.resolve()
        .then(() => schedule.callback(snapshot, controlsRef.current!))
        .then(
          () => {
            emitDebug(optionsRef.current.debug, {
              type: 'schedule:end',
              scope: 'timer',
              scheduleId: schedule.id ?? key,
              ...baseDebugEvent(snapshot, generation),
            });
          },
          error => {
            emitDebug(optionsRef.current.debug, {
              type: 'schedule:error',
              scope: 'timer',
              scheduleId: schedule.id ?? key,
              error,
              ...baseDebugEvent(snapshot, generation),
            });
          },
        )
        .finally(() => {
          if (stateRef.current?.generation === generation) {
            scheduleState.pending = false;
          }
        });
    },
    [],
  );

  const evaluateSchedules = useCallback(
    (snapshot: TimerSnapshot, generation: number, activation = false) => {
      const schedules = optionsRef.current.schedules ?? [];
      const liveKeys = new Set<string>();

      schedules.forEach((schedule, index) => {
        const key = schedule.id ?? String(index);
        liveKeys.add(key);
        let scheduleState = schedulesRef.current.get(key);
        if (!scheduleState) {
          scheduleState = { lastRunAt: null, pending: false, leadingGeneration: null };
          schedulesRef.current.set(key, scheduleState);
        }

        if (activation && schedule.leading && scheduleState.leadingGeneration !== generation) {
          scheduleState.leadingGeneration = generation;
          runSchedule(schedule, key, scheduleState, snapshot, generation);
          return;
        }

        if (scheduleState.lastRunAt === null) {
          scheduleState.lastRunAt = snapshot.now;
          return;
        }

        if (snapshot.now - scheduleState.lastRunAt >= schedule.everyMs) {
          runSchedule(schedule, key, scheduleState, snapshot, generation);
        }
      });

      for (const key of schedulesRef.current.keys()) {
        if (!liveKeys.has(key)) schedulesRef.current.delete(key);
      }
    },
    [runSchedule],
  );

  const processRunningState = useCallback(
    (clock = readClock(), activation = false) => {
      const state = stateRef.current!;
      if (state.status !== 'running') return;

      const snapshot = toSnapshot(state, clock);
      const generation = state.generation;

      if (optionsRef.current.endWhen?.(snapshot)) {
        if (endTimerState(state, clock)) {
          const endedSnapshot = toSnapshot(state, clock);
          emit('timer:end', endedSnapshot);
          clearScheduledTick();
          callOnEnd(endedSnapshot);
          rerender();
        }
        return;
      }

      evaluateSchedules(snapshot, generation, activation);
    },
    [callOnEnd, clearScheduledTick, emit, evaluateSchedules],
  );

  const getNextDelay = useCallback((clock = readClock()) => {
    const updateIntervalMs = optionsRef.current.updateIntervalMs ?? 1000;
    let nextDelay = updateIntervalMs;

    const state = stateRef.current!;
    if (state.status !== 'running') return updateIntervalMs;

    const schedules = optionsRef.current.schedules ?? [];
    schedules.forEach((schedule, index) => {
      const key = schedule.id ?? String(index);
      const scheduleState = schedulesRef.current.get(key);
      const lastRunAt = scheduleState?.lastRunAt ?? state.startedAt ?? clock.wallNow;
      nextDelay = Math.min(nextDelay, Math.max(1, lastRunAt + schedule.everyMs - clock.wallNow));
    });

    return nextDelay;
  }, []);

  const start = useCallback(() => {
    const clock = readClock();
    if (!startTimerState(stateRef.current!, clock)) return;
    const snapshot = toSnapshot(stateRef.current!, clock);
    emit('timer:start', snapshot);
    processRunningState(clock, true);
    rerender();
  }, [emit, processRunningState]);

  const pause = useCallback(() => {
    const clock = readClock();
    if (!pauseTimerState(stateRef.current!, clock)) return;
    clearScheduledTick();
    const snapshot = toSnapshot(stateRef.current!, clock);
    emit('timer:pause', snapshot);
    rerender();
  }, [clearScheduledTick, emit]);

  const resume = useCallback(() => {
    const clock = readClock();
    if (!resumeTimerState(stateRef.current!, clock)) return;
    const snapshot = toSnapshot(stateRef.current!, clock);
    emit('timer:resume', snapshot);
    processRunningState(clock, true);
    rerender();
  }, [emit, processRunningState]);

  const reset = useCallback(
    (resetOptions: { autoStart?: boolean } = {}) => {
      const clock = readClock();
      clearScheduledTick();
      resetTimerState(stateRef.current!, clock, resetOptions);
      schedulesRef.current.clear();
      endCalledGenerationRef.current = null;
      const snapshot = toSnapshot(stateRef.current!, clock);
      emit('timer:reset', snapshot);
      if (resetOptions.autoStart) processRunningState(clock, true);
      rerender();
    },
    [clearScheduledTick, emit, processRunningState],
  );

  const restart = useCallback(() => {
    const clock = readClock();
    clearScheduledTick();
    restartTimerState(stateRef.current!, clock);
    schedulesRef.current.clear();
    endCalledGenerationRef.current = null;
    const snapshot = toSnapshot(stateRef.current!, clock);
    emit('timer:restart', snapshot);
    processRunningState(clock, true);
    rerender();
  }, [clearScheduledTick, emit, processRunningState]);

  const cancel = useCallback(
    (reason?: string) => {
      const clock = readClock();
      if (!cancelTimerState(stateRef.current!, clock, reason)) return;
      clearScheduledTick();
      const snapshot = toSnapshot(stateRef.current!, clock);
      emit('timer:cancel', snapshot, { reason });
      rerender();
    },
    [clearScheduledTick, emit],
  );

  controlsRef.current = useMemo(
    () => ({ start, pause, resume, reset, restart, cancel }),
    [cancel, pause, reset, restart, resume, start],
  );

  useEffect(() => {
    mountedRef.current = true;
    if (optionsRef.current.autoStart && stateRef.current!.status === 'idle') {
      controlsRef.current!.start();
    }

    return () => {
      mountedRef.current = false;
      clearScheduledTick();
    };
  }, [clearScheduledTick]);

  const snapshot = getSnapshot();
  const generation = stateRef.current.generation;
  const status = snapshot.status;

  useEffect(() => {
    if (!mountedRef.current || status !== 'running') {
      clearScheduledTick();
      return;
    }

    clearScheduledTick();
    emit('scheduler:start', getSnapshot());
    timeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      if (stateRef.current!.generation !== generation) return;
      if (stateRef.current!.status !== 'running') return;

      const clock = readClock();
      tickTimerState(stateRef.current!, clock);
      const tickSnapshot = toSnapshot(stateRef.current!, clock);
      emit('timer:tick', tickSnapshot);
      processRunningState(clock);
      rerender();
    }, getNextDelay());

    return () => {
      if (timeoutRef.current !== null) {
        emit('scheduler:stop', getSnapshot());
      }
      clearScheduledTick();
    };
  }, [clearScheduledTick, emit, generation, getNextDelay, getSnapshot, processRunningState, snapshot.tick, status]);

  return {
    ...snapshot,
    ...controlsRef.current,
  };
}

function validateSchedules(schedules: TimerSchedule[] | undefined): void {
  schedules?.forEach(schedule => validatePositiveFinite(schedule.everyMs, 'schedule.everyMs'));
}
