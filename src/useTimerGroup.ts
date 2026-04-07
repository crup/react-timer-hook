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
import type {
  TimerGroupItem,
  TimerGroupItemControls,
  TimerGroupResult,
  TimerSnapshot,
  UseTimerGroupOptions,
} from './types';

type InternalGroupItem = TimerItem<TimerGroupItemControls, TimerGroupItem> & {
  id: string;
  schedules: Map<string, ScheduleState>;
};

type TimerGroupStore = {
  controls: Omit<TimerGroupResult, 'now' | 'size' | 'ids' | 'get'>;
  commitOptions(): void;
  destroy(): void;
  getSnapshot(): Pick<TimerGroupResult, 'now' | 'size' | 'ids'>;
  getServerSnapshot(): Pick<TimerGroupResult, 'now' | 'size' | 'ids'>;
  getTimer(id: string): TimerSnapshot | undefined;
  setOptions(options: UseTimerGroupOptions): void;
  subscribe(listener: () => void): () => void;
};

export function useTimerGroup(options: UseTimerGroupOptions = {}): TimerGroupResult {
  const storeRef = useRef<TimerGroupStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createTimerGroupStore(options);
  }

  storeRef.current.setOptions(options);

  useEffect(() => {
    storeRef.current?.commitOptions();
  });

  useEffect(() => {
    const store = storeRef.current!;
    return () => store.destroy();
  }, []);

  const groupSnapshot = useSyncExternalStore(storeRef.current.subscribe, storeRef.current.getSnapshot, storeRef.current.getServerSnapshot);

  return {
    ...groupSnapshot,
    get: storeRef.current.getTimer,
    ...storeRef.current.controls,
  };
}

function createTimerGroupStore(initialOptions: UseTimerGroupOptions): TimerGroupStore {
  let options = initialOptions;
  validateOptions(options);

  const listeners = new Set<() => void>();
  const items = new Map<string, InternalGroupItem>();
  let snapshotClock = readClock();
  let snapshot = createGroupSnapshot(items, snapshotClock.wallNow);
  const serverSnapshot = snapshot;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let syncSignature = getSyncSignature(options);
  let pendingOptionsCommit = true;

  const notify = (clock = readClock()) => {
    snapshotClock = clock;
    snapshot = createGroupSnapshot(items, clock.wallNow);
    listeners.forEach(listener => listener());
  };

  const clearTimeoutRef = () => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  const emit = (
    type: Parameters<typeof emitDiagnostics>[1]['type'],
    item: InternalGroupItem | undefined,
    eventSnapshot: TimerSnapshot,
    extra: Partial<Parameters<typeof emitDiagnostics>[1]> = {},
  ) => {
    emitDiagnostics(options.diagnostics, {
      type,
      scope: 'timer-group',
      timerId: item?.id,
      ...baseDebugEvent(eventSnapshot, item?.state.generation ?? 0),
      ...extra,
    });
  };

  const onEndError = (item: InternalGroupItem) => (error: unknown, eventSnapshot: TimerSnapshot, generation: number) => {
    const callbackControls = guardTimerControls(itemControls(item.id), () => items.get(item.id) === item && item.state.generation === generation);
    item.definition.onError?.(error, eventSnapshot, callbackControls);
    emitDiagnostics(options.diagnostics, {
      type: 'callback:error',
      scope: 'timer-group',
      timerId: item.id,
      error,
      ...baseDebugEvent(eventSnapshot, generation),
    });
  };

  const emitSchedule = (item: InternalGroupItem, eventSnapshot: TimerSnapshot, generation: number) => (event: ScheduleEvent) => {
    emitDiagnostics(options.diagnostics, {
      type: event.type,
      scope: 'timer-group',
      timerId: item.id,
      ...event.context,
      ...('reason' in event ? { reason: event.reason } : {}),
      ...('error' in event ? { error: event.error } : {}),
      ...baseDebugEvent(eventSnapshot, generation),
    });
  };

  const itemControls = (id: string): TimerGroupItemControls => ({
    start: () => start(id),
    pause: () => pause(id),
    resume: () => resume(id),
    reset: resetOptions => reset(id, resetOptions),
    restart: () => restart(id),
    cancel: reason => cancel(id, reason),
  });

  const processItem = (item: InternalGroupItem, clock = readClock(), activation = false) => {
    if (item.state.status !== 'running') return false;

    const generation = item.state.generation;
    const controls = guardTimerControls(itemControls(item.id), () => items.get(item.id) === item && item.state.generation === generation);
    const endedSnapshot = endTimerItemIfNeeded(item, clock, controls, onEndError(item));
    if (endedSnapshot) {
      emit('timer:end', item, endedSnapshot);
      return true;
    }

    const currentSnapshot = getTimerItemSnapshot(item, clock);
    evaluateSchedules({
      schedules: item.definition.schedules,
      states: item.schedules,
      snapshot: currentSnapshot,
      generation: item.state.generation,
      controls,
      activation,
      isLive: generation => items.get(item.id) === item && item.state.generation === generation,
      onError: (error, errorSnapshot, errorControls) => item.definition.onError?.(error, errorSnapshot, errorControls),
      onEvent: emitSchedule(item, currentSnapshot, item.state.generation),
    });
    return false;
  };

  const schedule = (emitStart = true) => {
    clearTimeoutRef();
    const runningItems = Array.from(items.values()).filter(item => item.state.status === 'running');
    if (runningItems.length === 0) return;

    const clock = readClock();
    let delay = options.updateIntervalMs ?? 1000;
    for (const item of runningItems) {
      delay = Math.min(delay, getNextScheduleDelay(item.definition.schedules, item.schedules, clock.wallNow, delay));
    }

    if (emitStart) emit('scheduler:start', runningItems[0], getTimerItemSnapshot(runningItems[0], clock));
    timeout = setTimeout(() => {
      const tickClock = readClock();
      for (const item of items.values()) {
        if (item.state.status !== 'running') continue;
        tickTimerState(item.state, tickClock);
        const tickSnapshot = getTimerItemSnapshot(item, tickClock);
        emit('timer:tick', item, tickSnapshot);
        processItem(item, tickClock);
      }
      notify(tickClock);
      schedule();
    }, delay);
  };

  const ensureItem = (definition: TimerGroupItem) => {
    const existing = items.get(definition.id);
    if (existing) {
      existing.definition = definition;
      seedNewSchedules(existing, readClock().wallNow);
      return { item: existing, added: false };
    }

    const clock = readClock();
    const item: InternalGroupItem = {
      ...createTimerItem(definition, clock),
      id: definition.id,
      schedules: new Map(),
    };
    items.set(definition.id, item);
    seedNewSchedules(item, clock.wallNow);
    return { item, added: true };
  };

  const sync = (syncOptions: { notify?: boolean; process?: boolean; reschedule?: boolean; autoStart?: boolean } = {}) => {
    const notifyListeners = syncOptions.notify ?? true;
    const processLifecycle = syncOptions.process ?? true;
    const forceReschedule = syncOptions.reschedule ?? true;
    const startAuto = syncOptions.autoStart ?? true;
    validateOptions(options);
    const liveIds = new Set<string>();
    let changed = false;
    const clock = readClock();

    if (options.items) {
      for (const definition of options.items) {
        liveIds.add(definition.id);
        const { item, added } = ensureItem(definition);
        changed = changed || added;
        if (startAuto && definition.autoStart && item.state.status === 'idle') {
          if (startTimerState(item.state, clock)) {
            changed = true;
            if (processLifecycle) changed = processItem(item, clock, true) || changed;
          }
        }
        if (processLifecycle) changed = processItem(item, clock) || changed;
      }

      for (const id of items.keys()) {
        if (!liveIds.has(id)) {
          items.delete(id);
          changed = true;
        }
      }
    }

    if (changed) {
      if (notifyListeners) {
        notify(clock);
      } else {
        snapshotClock = clock;
        snapshot = createGroupSnapshot(items, clock.wallNow);
      }
    }
    if (changed || forceReschedule) schedule(notifyListeners);
  };

  const add = (definition: TimerGroupItem) => {
    validateItems([definition]);
    if (items.has(definition.id)) throw new Error(`Timer item "${definition.id}" already exists`);
    const { item } = ensureItem(definition);
    const clock = readClock();
    if (definition.autoStart && startTimerState(item.state, clock)) {
      processItem(item, clock, true);
    }
    syncSignature = getSyncSignature(options);
    notify(clock);
    schedule();
  };

  const update = (id: string, definition: Partial<Omit<TimerGroupItem, 'id'>>) => {
    const item = items.get(id);
    if (!item) return;
    const next = { ...item.definition, ...definition, id };
    validateItems([next]);
    item.definition = next;
    seedNewSchedules(item, readClock().wallNow);
    processItem(item);
    syncSignature = getSyncSignature(options);
    notify();
    schedule();
  };

  const remove = (id: string) => {
    if (!items.delete(id)) return;
    notify();
    schedule();
  };

  const clear = () => {
    items.clear();
    clearTimeoutRef();
    notify();
  };

  const start = (id: string) => {
    const item = items.get(id);
    if (!item) return;
    const clock = readClock();
    if (!startTimerState(item.state, clock)) return;
    emit('timer:start', item, getTimerItemSnapshot(item, clock));
    processItem(item, clock, true);
    notify(clock);
    schedule();
  };

  const pause = (id: string) => {
    const item = items.get(id);
    if (!item) return;
    const clock = readClock();
    if (!pauseTimerState(item.state, clock)) return;
    emit('timer:pause', item, getTimerItemSnapshot(item, clock));
    notify(clock);
    schedule();
  };

  const resume = (id: string) => {
    const item = items.get(id);
    if (!item) return;
    const clock = readClock();
    if (!resumeTimerState(item.state, clock)) return;
    emit('timer:resume', item, getTimerItemSnapshot(item, clock));
    processItem(item, clock, true);
    notify(clock);
    schedule();
  };

  const reset = (id: string, resetOptions: { autoStart?: boolean } = {}) => {
    const item = items.get(id);
    if (!item) return;
    const clock = readClock();
    resetTimerState(item.state, clock, resetOptions);
    item.schedules.clear();
    seedNewSchedules(item, clock.wallNow);
    resetTimerItemEndGuard(item);
    emit('timer:reset', item, getTimerItemSnapshot(item, clock));
    processItem(item, clock, resetOptions.autoStart);
    notify(clock);
    schedule();
  };

  const restart = (id: string) => {
    const item = items.get(id);
    if (!item) return;
    const clock = readClock();
    restartTimerState(item.state, clock);
    item.schedules.clear();
    seedNewSchedules(item, clock.wallNow);
    resetTimerItemEndGuard(item);
    emit('timer:restart', item, getTimerItemSnapshot(item, clock));
    processItem(item, clock, true);
    notify(clock);
    schedule();
  };

  const cancel = (id: string, reason?: string) => {
    const item = items.get(id);
    if (!item) return;
    const clock = readClock();
    if (!cancelTimerState(item.state, clock, reason)) return;
    emit('timer:cancel', item, getTimerItemSnapshot(item, clock), { reason });
    notify(clock);
    schedule();
  };

  const getTimer = (id: string) => {
    const item = items.get(id);
    return item ? getTimerItemSnapshot(item, snapshotClock) : undefined;
  };

  const controls: TimerGroupStore['controls'] = {
    add,
    update,
    remove,
    clear,
    start,
    pause,
    resume,
    reset,
    restart,
    cancel,
    startAll: () => Array.from(items.keys()).forEach(start),
    pauseAll: () => Array.from(items.keys()).forEach(pause),
    resumeAll: () => Array.from(items.keys()).forEach(resume),
    resetAll: resetOptions => Array.from(items.keys()).forEach(id => reset(id, resetOptions)),
    restartAll: () => Array.from(items.keys()).forEach(restart),
    cancelAll: reason => Array.from(items.keys()).forEach(id => cancel(id, reason)),
  };

  sync({ notify: false, process: false, reschedule: false, autoStart: false });

  return {
    commitOptions: () => {
      if (!pendingOptionsCommit) return;
      pendingOptionsCommit = false;
      sync({ notify: true, process: true, reschedule: true, autoStart: true });
    },
    controls,
    destroy: clearTimeoutRef,
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    getTimer,
    setOptions: nextOptions => {
      validateOptions(nextOptions);
      const nextSignature = getSyncSignature(nextOptions);
      pendingOptionsCommit = pendingOptionsCommit || nextOptions.items !== options.items || nextSignature !== syncSignature;
      options = nextOptions;
      syncSignature = nextSignature;
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function createGroupSnapshot(items: Map<string, InternalGroupItem>, now: number): Pick<TimerGroupResult, 'now' | 'size' | 'ids'> {
  return {
    now,
    size: items.size,
    ids: Array.from(items.keys()),
  };
}

function seedNewSchedules(item: InternalGroupItem, now: number): void {
  syncScheduleStates(item.definition.schedules, item.schedules, now, item.state.status === 'running');
}

function getSyncSignature(options: UseTimerGroupOptions): string {
  return JSON.stringify([
    options.updateIntervalMs ?? 1000,
    ...(options.items ?? []).map(item => {
      const schedules = getScheduleSignature(item.schedules);
      return [item.id, item.autoStart ?? false, schedules ?? ''];
    }),
  ]);
}

function validateOptions(options: UseTimerGroupOptions): void {
  validatePositiveFinite(options.updateIntervalMs ?? 1000, 'updateIntervalMs');
  validateItems(options.items);
}

function validateItems(items: TimerGroupItem[] | undefined): void {
  const ids = new Set<string>();
  items?.forEach(item => {
    if (!item.id) throw new Error('Timer item id is required');
    if (ids.has(item.id)) throw new Error(`Duplicate timer item id "${item.id}"`);
    ids.add(item.id);
    validateSchedules(item.schedules);
  });
}
