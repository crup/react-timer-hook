import type { ClockRead } from './clocks';
import {
  createTimerState,
  endTimerState,
  toSnapshot,
  type InternalTimerState,
} from './state';
import type { TimerControls, TimerEndPredicate, TimerSnapshot } from './types';

export type TimerItemDefinition<TControls extends TimerControls = TimerControls> = {
  endWhen?: TimerEndPredicate;
  onEnd?: (snapshot: TimerSnapshot, controls: TControls) => void | Promise<void>;
};

export type TimerItem<
  TControls extends TimerControls = TimerControls,
  TDefinition extends TimerItemDefinition<TControls> = TimerItemDefinition<TControls>,
> = {
  state: InternalTimerState;
  definition: TDefinition;
  endCalledGeneration: number | null;
};

export type TimerEndErrorHandler = (
  error: unknown,
  snapshot: TimerSnapshot,
  generation: number,
) => void;

export function createTimerItem<
  TControls extends TimerControls,
  TDefinition extends TimerItemDefinition<TControls>,
>(
  definition: TDefinition,
  clock: ClockRead,
): TimerItem<TControls, TDefinition> {
  return {
    state: createTimerState(clock),
    definition,
    endCalledGeneration: null,
  };
}

export function resetTimerItemEndGuard(item: TimerItem): void {
  item.endCalledGeneration = null;
}

export function getTimerItemSnapshot(item: TimerItem, clock: ClockRead): TimerSnapshot {
  return toSnapshot(item.state, clock);
}

export function endTimerItemIfNeeded<TControls extends TimerControls>(
  item: TimerItem<TControls>,
  clock: ClockRead,
  controls: TControls,
  onError?: TimerEndErrorHandler,
): TimerSnapshot | null {
  const snapshot = toSnapshot(item.state, clock);
  if (!item.definition.endWhen?.(snapshot)) return null;
  if (!endTimerState(item.state, clock)) return null;

  const endedSnapshot = toSnapshot(item.state, clock);
  callTimerItemOnEnd(item, endedSnapshot, controls, onError);
  return endedSnapshot;
}

export function callTimerItemOnEnd<TControls extends TimerControls>(
  item: TimerItem<TControls>,
  snapshot: TimerSnapshot,
  controls: TControls,
  onError?: TimerEndErrorHandler,
): void {
  const generation = item.state.generation;
  if (item.endCalledGeneration === generation) return;
  item.endCalledGeneration = generation;

  try {
    const result = item.definition.onEnd?.(snapshot, controls);
    if (result && onError) {
      void Promise.resolve(result).catch(error => onError?.(error, snapshot, generation));
    }
  } catch (error) {
    if (onError) {
      onError(error, snapshot, generation);
      return;
    }
    throw error;
  }
}
