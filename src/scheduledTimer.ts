import { useEffect, useRef, useSyncExternalStore } from 'react';
import { readClock, validatePositiveFinite } from './clocks';
import { guardTimerControls } from './controls';
import { baseDebugEvent, emitDiagnostics } from './debug';
import {
  evaluateSchedules,
  getScheduleSignature,
  getNextScheduleDelay,
  syncScheduleStates,
  validateSchedules,
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
  commitOptions(): void;
  destroy(): void;
  getSnapshot(): TimerSnapshot;
  getServerSnapshot(): TimerSnapshot;
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
    storeRef.current?.commitOptions();
  });

  useEffect(() => {
    const store = storeRef.current!;
    if (options.autoStart) store.controls.start();
    return () => store.destroy();
  }, []);

  const snapshot = useSyncExternalStore(storeRef.current.subscribe, storeRef.current.getSnapshot, storeRef.current.getServerSnapshot);
  return { ...snapshot, ...storeRef.current.controls };
}

function createScheduledTimerStore(initialOptions: UseScheduledTimerOptions): ScheduledTimerStore {
  let options = initialOptions;
  validateOptions(options);

  const listeners = new Set<() => void>();
  const item: TimerItem<TimerControls, UseScheduledTimerOptions> = createTimerItem(options, readClock());
  const schedules = new Map<string, ScheduleState>();
  let snapshot = getTimerItemSnapshot(item, readClock());
  const serverSnapshot = snapshot;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let scheduleSignature = getScheduleSignature(options.schedules);
  let pendingOptionsCommit = false;

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
    const callbackControls = guardTimerControls(controls, () => item.state.generation === generation);
    options.onError?.(error, eventSnapshot, callbackControls);
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

    const generation = item.state.generation;
    const callbackControls = guardTimerControls(controls, () => item.state.generation === generation);
    const endedSnapshot = endTimerItemIfNeeded(item, clock, callbackControls, onEndError);
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
      controls: callbackControls,
      activation,
      isLive: generation => item.state.generation === generation,
      onError: (error, errorSnapshot, errorControls) => options.onError?.(error, errorSnapshot, errorControls),
      onEvent: emitSchedule(currentSnapshot, item.state.generation),
    });
    return false;
  };

  const schedule = (emitStart = true) => {
    clear();
    if (item.state.status !== 'running') return;

    const delay = getNextScheduleDelay(options.schedules, schedules, readClock().wallNow, options.updateIntervalMs ?? 1000);
    if (emitStart) emit('scheduler:start', getTimerItemSnapshot(item, readClock()));
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
    commitOptions: () => {
      if (!pendingOptionsCommit) return;
      pendingOptionsCommit = false;
      syncScheduleStates(options.schedules, schedules, readClock().wallNow, item.state.status === 'running');
      if (item.state.status === 'running') {
        const clock = readClock();
        if (!process(clock)) schedule(false);
      }
    },
    controls,
    destroy: clear,
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    setOptions: nextOptions => {
      validateOptions(nextOptions);
      const nextScheduleSignature = getScheduleSignature(nextOptions.schedules);
      const schedulesChanged = nextScheduleSignature !== scheduleSignature;
      pendingOptionsCommit =
        pendingOptionsCommit ||
        schedulesChanged ||
        (nextOptions.updateIntervalMs ?? 1000) !== (options.updateIntervalMs ?? 1000) ||
        nextOptions.endWhen !== options.endWhen;
      options = nextOptions;
      item.definition = nextOptions;
      if (schedulesChanged) {
        scheduleSignature = nextScheduleSignature;
      }
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function validateOptions(options: UseScheduledTimerOptions): void {
  validatePositiveFinite(options.updateIntervalMs ?? 1000, 'updateIntervalMs');
  validateSchedules(options.schedules);
}
