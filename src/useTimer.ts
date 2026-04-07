import { useEffect, useRef, useSyncExternalStore } from 'react';
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
import type { TimerControls, TimerSnapshot, UseTimerOptions } from './types';

type TimerStore = {
  controls: TimerControls;
  destroy(): void;
  getSnapshot(): TimerSnapshot;
  setOptions(options: UseTimerOptions): void;
  subscribe(listener: () => void): () => void;
};

export function useTimer(options: UseTimerOptions = {}): TimerSnapshot & TimerControls {
  const storeRef = useRef<TimerStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createTimerStore(options);
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

function createTimerStore(initialOptions: UseTimerOptions): TimerStore {
  let options = initialOptions;
  validatePositiveFinite(options.updateIntervalMs ?? 1000, 'updateIntervalMs');

  const listeners = new Set<() => void>();
  const state: InternalTimerState = createTimerState(readClock());
  let snapshot = toSnapshot(state, readClock());
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let endCalledGeneration: number | null = null;

  const notify = (clock = readClock()) => {
    snapshot = toSnapshot(state, clock);
    listeners.forEach(listener => listener());
  };

  const clear = () => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  const callOnEnd = (endedSnapshot: TimerSnapshot) => {
    if (endCalledGeneration === state.generation) return;
    endCalledGeneration = state.generation;
    const reportError = (error: unknown) => {
      if (options.onError) {
        options.onError(error, endedSnapshot, controls);
        return;
      }
      setTimeout(() => {
        throw error;
      }, 0);
    };
    try {
      Promise.resolve(options.onEnd?.(endedSnapshot, controls)).catch(error => {
        reportError(error);
      });
    } catch (error) {
      reportError(error);
    }
  };

  const endIfNeeded = (clock: ReturnType<typeof readClock>) => {
    const currentSnapshot = toSnapshot(state, clock);
    if (!options.endWhen?.(currentSnapshot) || !endTimerState(state, clock)) return false;

    clear();
    notify(clock);
    callOnEnd(toSnapshot(state, clock));
    return true;
  };

  const schedule = () => {
    clear();
    if (state.status !== 'running') return;

    timeout = setTimeout(() => {
      if (state.status !== 'running') return;

      const clock = readClock();
      tickTimerState(state, clock);

      if (endIfNeeded(clock)) return;

      notify(clock);
      schedule();
    }, options.updateIntervalMs ?? 1000);
  };

  const start = () => {
    const clock = readClock();
    if (!startTimerState(state, clock)) {
      if (state.status === 'running') schedule();
      return;
    }
    notify(clock);
    if (!endIfNeeded(clock)) schedule();
  };

  const pause = () => {
    const clock = readClock();
    if (!pauseTimerState(state, clock)) return;
    clear();
    notify(clock);
  };

  const resume = () => {
    const clock = readClock();
    if (!resumeTimerState(state, clock)) return;
    notify(clock);
    if (!endIfNeeded(clock)) schedule();
  };

  const reset = (resetOptions: { autoStart?: boolean } = {}) => {
    const clock = readClock();
    clear();
    resetTimerState(state, clock, resetOptions);
    endCalledGeneration = null;
    notify(clock);
    if (resetOptions.autoStart && !endIfNeeded(clock)) schedule();
  };

  const restart = () => {
    const clock = readClock();
    clear();
    restartTimerState(state, clock);
    endCalledGeneration = null;
    notify(clock);
    if (!endIfNeeded(clock)) schedule();
  };

  const cancel = (reason?: string) => {
    const clock = readClock();
    if (!cancelTimerState(state, clock, reason)) return;
    clear();
    notify(clock);
  };

  const controls: TimerControls = { start, pause, resume, reset, restart, cancel };

  return {
    controls,
    destroy: clear,
    getSnapshot: () => snapshot,
    setOptions: nextOptions => {
      validatePositiveFinite(nextOptions.updateIntervalMs ?? 1000, 'updateIntervalMs');
      options = nextOptions;
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
