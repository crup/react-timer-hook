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
import type {
  TimerControls,
  TimerGroupItem,
  TimerGroupItemControls,
  TimerGroupResult,
  TimerSchedule,
  TimerSnapshot,
  UseTimerGroupOptions,
} from './types';

type GroupScheduleState = {
  lastRunAt: number | null;
  pending: boolean;
  leadingGeneration: number | null;
};

type InternalGroupItem = {
  id: string;
  state: InternalTimerState;
  definition: TimerGroupItem;
  schedules: Map<string, GroupScheduleState>;
  endCalledGeneration: number | null;
};

export function useTimerGroup(options: UseTimerGroupOptions = {}): TimerGroupResult {
  const updateIntervalMs = options.updateIntervalMs ?? 1000;
  validatePositiveFinite(updateIntervalMs, 'updateIntervalMs');
  validateItems(options.items);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const itemsRef = useRef<Map<string, InternalGroupItem>>(new Map());
  const mountedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, rerender] = useReducer((value: number) => value + 1, 0);

  const clearScheduledTick = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const getItemSnapshot = useCallback((item: InternalGroupItem, clock = readClock()) => {
    return toSnapshot(item.state, clock);
  }, []);

  const emit = useCallback(
    (
      type: Parameters<typeof emitDebug>[1]['type'],
      item: InternalGroupItem | undefined,
      snapshot: TimerSnapshot,
      extra: Partial<Parameters<typeof emitDebug>[1]> = {},
    ) => {
      emitDebug(optionsRef.current.debug, {
        type,
        scope: 'timer-group',
        timerId: item?.id,
        ...baseDebugEvent(snapshot, item?.state.generation ?? 0),
        ...extra,
      });
    },
    [],
  );

  const controlsFor = useCallback((id: string): TimerGroupItemControls => {
    return {
      start: () => start(id),
      pause: () => pause(id),
      resume: () => resume(id),
      reset: resetOptions => reset(id, resetOptions),
      restart: () => restart(id),
      cancel: reason => cancel(id, reason),
    };
  }, []);

  const callOnEnd = useCallback(
    (item: InternalGroupItem, snapshot: TimerSnapshot) => {
      const generation = item.state.generation;
      if (item.endCalledGeneration === generation) return;
      item.endCalledGeneration = generation;

      try {
        void item.definition.onEnd?.(snapshot, controlsFor(item.id));
      } catch (error) {
        emitDebug(optionsRef.current.debug, {
          type: 'callback:error',
          scope: 'timer-group',
          timerId: item.id,
          error,
          ...baseDebugEvent(snapshot, generation),
        });
      }
    },
    [controlsFor],
  );

  const runSchedule = useCallback(
    (
      item: InternalGroupItem,
      schedule: TimerSchedule,
      key: string,
      scheduleState: GroupScheduleState,
      snapshot: TimerSnapshot,
      generation: number,
    ) => {
      if (scheduleState.pending && (schedule.overlap ?? 'skip') === 'skip') {
        emitDebug(optionsRef.current.debug, {
          type: 'schedule:skip',
          scope: 'timer-group',
          timerId: item.id,
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
        scope: 'timer-group',
        timerId: item.id,
        scheduleId: schedule.id ?? key,
        ...baseDebugEvent(snapshot, generation),
      });

      Promise.resolve()
        .then(() => schedule.callback(snapshot, controlsFor(item.id) as TimerControls))
        .then(
          () => {
            emitDebug(optionsRef.current.debug, {
              type: 'schedule:end',
              scope: 'timer-group',
              timerId: item.id,
              scheduleId: schedule.id ?? key,
              ...baseDebugEvent(snapshot, generation),
            });
          },
          error => {
            emitDebug(optionsRef.current.debug, {
              type: 'schedule:error',
              scope: 'timer-group',
              timerId: item.id,
              scheduleId: schedule.id ?? key,
              error,
              ...baseDebugEvent(snapshot, generation),
            });
          },
        )
        .finally(() => {
          const liveItem = itemsRef.current.get(item.id);
          if (liveItem?.state.generation === generation) {
            scheduleState.pending = false;
          }
        });
    },
    [controlsFor],
  );

  const evaluateItemSchedules = useCallback(
    (item: InternalGroupItem, snapshot: TimerSnapshot, activation = false) => {
      const schedules = item.definition.schedules ?? [];
      const liveKeys = new Set<string>();

      schedules.forEach((schedule, index) => {
        const key = schedule.id ?? String(index);
        liveKeys.add(key);
        let scheduleState = item.schedules.get(key);
        if (!scheduleState) {
          scheduleState = { lastRunAt: null, pending: false, leadingGeneration: null };
          item.schedules.set(key, scheduleState);
        }

        if (activation && schedule.leading && scheduleState.leadingGeneration !== item.state.generation) {
          scheduleState.leadingGeneration = item.state.generation;
          runSchedule(item, schedule, key, scheduleState, snapshot, item.state.generation);
          return;
        }

        if (scheduleState.lastRunAt === null) {
          scheduleState.lastRunAt = item.state.startedAt ?? snapshot.now;
          if (snapshot.now - scheduleState.lastRunAt >= schedule.everyMs) {
            runSchedule(item, schedule, key, scheduleState, snapshot, item.state.generation);
          }
          return;
        }

        if (snapshot.now - scheduleState.lastRunAt >= schedule.everyMs) {
          runSchedule(item, schedule, key, scheduleState, snapshot, item.state.generation);
        }
      });

      for (const key of item.schedules.keys()) {
        if (!liveKeys.has(key)) item.schedules.delete(key);
      }
    },
    [runSchedule],
  );

  const processItem = useCallback(
    (item: InternalGroupItem, clock = readClock(), activation = false) => {
      if (item.state.status !== 'running') return;

      const snapshot = toSnapshot(item.state, clock);
      if (item.definition.endWhen?.(snapshot)) {
        if (endTimerState(item.state, clock)) {
          const endedSnapshot = toSnapshot(item.state, clock);
          emit('timer:end', item, endedSnapshot);
          callOnEnd(item, endedSnapshot);
        }
        return;
      }

      evaluateItemSchedules(item, snapshot, activation);
    },
    [callOnEnd, emit, evaluateItemSchedules],
  );

  const ensureItem = useCallback((definition: TimerGroupItem): { item: InternalGroupItem; added: boolean } => {
    const existing = itemsRef.current.get(definition.id);
    if (existing) {
      existing.definition = definition;
      return { item: existing, added: false };
    }

    const item: InternalGroupItem = {
      id: definition.id,
      state: createTimerState(readClock()),
      definition,
      schedules: new Map(),
      endCalledGeneration: null,
    };
    itemsRef.current.set(definition.id, item);
    if (definition.autoStart) {
      startTimerState(item.state, readClock());
    }
    return { item, added: true };
  }, []);

  const syncItems = useCallback(() => {
    const definitions = optionsRef.current.items ?? [];
    const liveIds = new Set<string>();
    let changed = false;
    definitions.forEach(definition => {
      liveIds.add(definition.id);
      const { item, added } = ensureItem(definition);
      changed = changed || added;
      if (definition.autoStart && item.state.status === 'idle') {
        changed = startTimerState(item.state, readClock()) || changed;
      }
    });

    for (const id of itemsRef.current.keys()) {
      if (!liveIds.has(id)) {
        itemsRef.current.delete(id);
        changed = true;
      }
    }

    return changed;
  }, [ensureItem]);

  useEffect(() => {
    if (syncItems()) rerender();
  }, [syncItems, options.items]);

  const add = useCallback((item: TimerGroupItem) => {
    validateItems([item]);
    if (itemsRef.current.has(item.id)) throw new Error(`Timer item "${item.id}" already exists`);
    ensureItem(item);
    rerender();
  }, [ensureItem]);

  const update = useCallback((id: string, item: Partial<Omit<TimerGroupItem, 'id'>>) => {
    const existing = itemsRef.current.get(id);
    if (!existing) return;
    const next = { ...existing.definition, ...item, id };
    validateItems([next]);
    existing.definition = next;
    rerender();
  }, []);

  const remove = useCallback((id: string) => {
    itemsRef.current.delete(id);
    rerender();
  }, []);

  const clear = useCallback(() => {
    itemsRef.current.clear();
    clearScheduledTick();
    rerender();
  }, [clearScheduledTick]);

  const start = useCallback((id: string) => {
    const item = itemsRef.current.get(id);
    if (!item) return;
    const clock = readClock();
    if (!startTimerState(item.state, clock)) return;
    emit('timer:start', item, toSnapshot(item.state, clock));
    processItem(item, clock, true);
    rerender();
  }, [emit, processItem]);

  const pause = useCallback((id: string) => {
    const item = itemsRef.current.get(id);
    if (!item) return;
    const clock = readClock();
    if (!pauseTimerState(item.state, clock)) return;
    emit('timer:pause', item, toSnapshot(item.state, clock));
    rerender();
  }, [emit]);

  const resume = useCallback((id: string) => {
    const item = itemsRef.current.get(id);
    if (!item) return;
    const clock = readClock();
    if (!resumeTimerState(item.state, clock)) return;
    emit('timer:resume', item, toSnapshot(item.state, clock));
    processItem(item, clock, true);
    rerender();
  }, [emit, processItem]);

  const reset = useCallback((id: string, resetOptions: { autoStart?: boolean } = {}) => {
    const item = itemsRef.current.get(id);
    if (!item) return;
    const clock = readClock();
    resetTimerState(item.state, clock, resetOptions);
    item.schedules.clear();
    item.endCalledGeneration = null;
    emit('timer:reset', item, toSnapshot(item.state, clock));
    if (resetOptions.autoStart) processItem(item, clock, true);
    rerender();
  }, [emit, processItem]);

  const restart = useCallback((id: string) => {
    const item = itemsRef.current.get(id);
    if (!item) return;
    const clock = readClock();
    restartTimerState(item.state, clock);
    item.schedules.clear();
    item.endCalledGeneration = null;
    emit('timer:restart', item, toSnapshot(item.state, clock));
    processItem(item, clock, true);
    rerender();
  }, [emit, processItem]);

  const cancel = useCallback((id: string, reason?: string) => {
    const item = itemsRef.current.get(id);
    if (!item) return;
    const clock = readClock();
    if (!cancelTimerState(item.state, clock, reason)) return;
    emit('timer:cancel', item, toSnapshot(item.state, clock), { reason });
    rerender();
  }, [emit]);

  const ids = Array.from(itemsRef.current.keys());
  const activeSignature = ids
    .map(id => `${id}:${itemsRef.current.get(id)!.state.status}:${itemsRef.current.get(id)!.state.generation}:${itemsRef.current.get(id)!.state.tick}`)
    .join('|');

  useEffect(() => {
    mountedRef.current = true;
    const runningItems = Array.from(itemsRef.current.values()).filter(item => item.state.status === 'running');
    if (runningItems.length === 0) {
      clearScheduledTick();
      return;
    }

    clearScheduledTick();
    const first = runningItems[0];
    emit('scheduler:start', first, toSnapshot(first.state, readClock()));
    timeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;

      const clock = readClock();
      for (const item of itemsRef.current.values()) {
        if (item.state.status !== 'running') continue;
        tickTimerState(item.state, clock);
        const snapshot = toSnapshot(item.state, clock);
        emit('timer:tick', item, snapshot);
        processItem(item, clock);
      }

      rerender();
    }, optionsRef.current.updateIntervalMs ?? 1000);

    return () => {
      if (timeoutRef.current !== null) {
        emit('scheduler:stop', first, toSnapshot(first.state, readClock()));
      }
      clearScheduledTick();
      mountedRef.current = false;
    };
  }, [activeSignature, clearScheduledTick, emit, processItem]);

  const get = useCallback(
    (id: string) => {
      const item = itemsRef.current.get(id);
      if (!item) return undefined;
      return getItemSnapshot(item);
    },
    [getItemSnapshot],
  );

  const now = readClock().wallNow;

  return useMemo(
    () => ({
      now,
      size: itemsRef.current.size,
      ids: Array.from(itemsRef.current.keys()),
      get,
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
      startAll: () => Array.from(itemsRef.current.keys()).forEach(start),
      pauseAll: () => Array.from(itemsRef.current.keys()).forEach(pause),
      resumeAll: () => Array.from(itemsRef.current.keys()).forEach(resume),
      resetAll: (resetOptions?: { autoStart?: boolean }) => Array.from(itemsRef.current.keys()).forEach(id => reset(id, resetOptions)),
      restartAll: () => Array.from(itemsRef.current.keys()).forEach(restart),
      cancelAll: (reason?: string) => Array.from(itemsRef.current.keys()).forEach(id => cancel(id, reason)),
    }),
    [add, cancel, clear, get, now, pause, remove, reset, restart, resume, start, update],
  );
}

function validateItems(items: TimerGroupItem[] | undefined): void {
  const ids = new Set<string>();
  items?.forEach(item => {
    if (ids.has(item.id)) throw new Error(`Duplicate timer item id "${item.id}"`);
    ids.add(item.id);
    item.schedules?.forEach(schedule => validatePositiveFinite(schedule.everyMs, 'schedule.everyMs'));
  });
}
