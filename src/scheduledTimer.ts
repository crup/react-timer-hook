import { useEffect, useRef, useSyncExternalStore } from 'react';
import { readClock, validatePositiveFinite } from './clocks';
import { baseDebugEvent, emitDiagnostics } from './debug';
import {
  evaluateSchedules,
  getNextScheduleDelay,
  syncScheduleStates,
  type ScheduleEvent,
  type ScheduleState,
} from './scheduleCore';
import {
  cancelTimerState,
  pauseTimerState,
  resetTimerState,
  restartTimerState,
  resumeTimerState,
  startTimerState,
  tickTimerState,
} from './state';
import {
  createTimerItem,
  endTimerItemIfNeeded,
  getTimerItemSnapshot,
  resetTimerItemEndGuard,
  type TimerItem,
} from './timerItem';
import type { TimerControls, TimerSnapshot, UseScheduledTimerOptions } from './types';

type ScheduledTimerStore = {
  controls: TimerControls;
  destroy(): void;
  getSnapshot(): TimerSnapshot;
  setOptions(options: UseScheduledTimerOptions): void;
  subscribe(listener: () => void): () => void;
};

export function useScheduledTimer(options: UseScheduledTimerOptions = {}): TimerSnapshot & TimerControls {
  const storeRef = useRef<ScheduledTimerStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createScheduledTimerStore(options);
  }

  storeRef.current.setOptions(options);

  useEffect(() => {
    const store = storeRef.current!;
    if (options.autoStart) store.controls.start();
    return () => store.destroy();
  }, []);

  const snapshot = useSyncExternalStore(storeRef.current.subscribe, storeRef.current.getSnapshot, storeRef.current.getSnapshot);
  return { ...snapshot, ...storeRef.current.controls };
}

function createScheduledTimerStore(initialOptions: UseScheduledTimerOptions): ScheduledTimerStore {
  let options = initialOptions;
  validateOptions(options);

  const listeners = new Set<() => void>();
  const item: TimerItem<TimerControls, UseScheduledTimerOptions> = createTimerItem(options, readClock());
  const schedules = new Map<string, ScheduleState>();
  let snapshot = getTimerItemSnapshot(item, readClock());
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const notify = (clock = readClock()) => {
    snapshot = getTimerItemSnapshot(item, clock);
    listeners.forEach(listener => listener());
  };

  const clear = () => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  const emit = (type: Parameters<typeof emitDiagnostics>[1]['type'], eventSnapshot: TimerSnapshot, extra: Partial<Parameters<typeof emitDiagnostics>[1]> = {}) => {
    emitDiagnostics(options.diagnostics, {
      type,
      scope: 'timer',
      ...baseDebugEvent(eventSnapshot, item.state.generation),
      ...extra,
    });
  };

  const onEndError = (error: unknown, eventSnapshot: TimerSnapshot, generation: number) => {
    emitDiagnostics(options.diagnostics, {
      type: 'callback:error',
      scope: 'timer',
      error,
      ...baseDebugEvent(eventSnapshot, generation),
    });
  };

  const emitSchedule = (eventSnapshot: TimerSnapshot, generation: number) => (event: ScheduleEvent) => {
    emitDiagnostics(options.diagnostics, {
      type: event.type,
      scope: 'timer',
      ...event.context,
      ...('reason' in event ? { reason: event.reason } : {}),
      ...('error' in event ? { error: event.error } : {}),
      ...baseDebugEvent(eventSnapshot, generation),
    });
  };

  const process = (clock = readClock(), activation = false) => {
    if (item.state.status !== 'running') return false;

    const endedSnapshot = endTimerItemIfNeeded(item, clock, controls, onEndError);
    if (endedSnapshot) {
      clear();
      emit('timer:end', endedSnapshot);
      notify(clock);
      return true;
    }

    const currentSnapshot = getTimerItemSnapshot(item, clock);
    evaluateSchedules({
      schedules: options.schedules,
      states: schedules,
      snapshot: currentSnapshot,
      generation: item.state.generation,
      controls,
      activation,
      isLive: generation => item.state.generation === generation,
      onEvent: emitSchedule(currentSnapshot, item.state.generation),
    });
    return false;
  };

  const schedule = () => {
    clear();
    if (item.state.status !== 'running') return;

    const delay = getNextScheduleDelay(options.schedules, schedules, readClock().wallNow, options.updateIntervalMs ?? 1000);
    emit('scheduler:start', getTimerItemSnapshot(item, readClock()));
    timeout = setTimeout(() => {
      if (item.state.status !== 'running') return;

      const clock = readClock();
      tickTimerState(item.state, clock);
      const tickSnapshot = getTimerItemSnapshot(item, clock);
      emit('timer:tick', tickSnapshot);

      if (!process(clock)) {
        notify(clock);
        schedule();
      }
    }, delay);
  };

  const start = () => {
    const clock = readClock();
    if (!startTimerState(item.state, clock)) {
      if (item.state.status === 'running') schedule();
      return;
    }
    emit('timer:start', getTimerItemSnapshot(item, clock));
    process(clock, true);
    notify(clock);
    schedule();
  };

  const pause = () => {
    const clock = readClock();
    if (!pauseTimerState(item.state, clock)) return;
    clear();
    emit('timer:pause', getTimerItemSnapshot(item, clock));
    notify(clock);
  };

  const resume = () => {
    const clock = readClock();
    if (!resumeTimerState(item.state, clock)) return;
    emit('timer:resume', getTimerItemSnapshot(item, clock));
    process(clock, true);
    notify(clock);
    schedule();
  };

  const reset = (resetOptions: { autoStart?: boolean } = {}) => {
    const clock = readClock();
    clear();
    resetTimerState(item.state, clock, resetOptions);
    schedules.clear();
    resetTimerItemEndGuard(item);
    emit('timer:reset', getTimerItemSnapshot(item, clock));
    process(clock, resetOptions.autoStart);
    notify(clock);
    schedule();
  };

  const restart = () => {
    const clock = readClock();
    clear();
    restartTimerState(item.state, clock);
    schedules.clear();
    resetTimerItemEndGuard(item);
    emit('timer:restart', getTimerItemSnapshot(item, clock));
    process(clock, true);
    notify(clock);
    schedule();
  };

  const cancel = (reason?: string) => {
    const clock = readClock();
    if (!cancelTimerState(item.state, clock, reason)) return;
    clear();
    emit('timer:cancel', getTimerItemSnapshot(item, clock), { reason });
    notify(clock);
  };

  const controls: TimerControls = { start, pause, resume, reset, restart, cancel };

  return {
    controls,
    destroy: clear,
    getSnapshot: () => snapshot,
    setOptions: nextOptions => {
      validateOptions(nextOptions);
      options = nextOptions;
      item.definition = nextOptions;
      syncScheduleStates(options.schedules, schedules, readClock().wallNow, item.state.status === 'running');
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function validateOptions(options: UseScheduledTimerOptions): void {
  validatePositiveFinite(options.updateIntervalMs ?? 1000, 'updateIntervalMs');
  options.schedules?.forEach(schedule => validatePositiveFinite(schedule.everyMs, 'schedule.everyMs'));
}
