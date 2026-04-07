import type { ClockRead } from './clocks';
import type { TimerSnapshot, TimerStatus } from './types';

export type InternalTimerState = {
  status: TimerStatus;
  generation: number;
  tick: number;
  startedAt: number | null;
  pausedAt: number | null;
  endedAt: number | null;
  cancelledAt: number | null;
  cancelReason: string | null;
  baseElapsedMilliseconds: number;
  activeStartedAtMonotonic: number | null;
  now: number;
};

export function createTimerState(clock: ClockRead): InternalTimerState {
  return {
    status: 'idle',
    generation: 0,
    tick: 0,
    startedAt: null,
    pausedAt: null,
    endedAt: null,
    cancelledAt: null,
    cancelReason: null,
    baseElapsedMilliseconds: 0,
    activeStartedAtMonotonic: null,
    now: clock.wallNow,
  };
}

export function getElapsedMilliseconds(state: InternalTimerState, clock: ClockRead): number {
  if (state.status !== 'running' || state.activeStartedAtMonotonic === null) {
    return state.baseElapsedMilliseconds;
  }

  return Math.max(0, state.baseElapsedMilliseconds + clock.monotonicNow - state.activeStartedAtMonotonic);
}

export function toSnapshot(state: InternalTimerState, clock: ClockRead): TimerSnapshot {
  const elapsedMilliseconds = getElapsedMilliseconds(state, clock);

  return {
    status: state.status,
    now: clock.wallNow,
    tick: state.tick,
    startedAt: state.startedAt,
    pausedAt: state.pausedAt,
    endedAt: state.endedAt,
    cancelledAt: state.cancelledAt,
    cancelReason: state.cancelReason,
    elapsedMilliseconds,
    isIdle: state.status === 'idle',
    isRunning: state.status === 'running',
    isPaused: state.status === 'paused',
    isEnded: state.status === 'ended',
    isCancelled: state.status === 'cancelled',
  };
}

export function startTimerState(state: InternalTimerState, clock: ClockRead): boolean {
  if (state.status !== 'idle') return false;

  state.status = 'running';
  state.startedAt = clock.wallNow;
  state.pausedAt = null;
  state.endedAt = null;
  state.cancelledAt = null;
  state.cancelReason = null;
  state.activeStartedAtMonotonic = clock.monotonicNow;
  state.now = clock.wallNow;
  return true;
}

export function pauseTimerState(state: InternalTimerState, clock: ClockRead): boolean {
  if (state.status !== 'running') return false;

  state.baseElapsedMilliseconds = getElapsedMilliseconds(state, clock);
  state.activeStartedAtMonotonic = null;
  state.status = 'paused';
  state.pausedAt = clock.wallNow;
  state.now = clock.wallNow;
  return true;
}

export function resumeTimerState(state: InternalTimerState, clock: ClockRead): boolean {
  if (state.status !== 'paused') return false;

  state.status = 'running';
  state.pausedAt = null;
  state.activeStartedAtMonotonic = clock.monotonicNow;
  state.now = clock.wallNow;
  return true;
}

export function resetTimerState(
  state: InternalTimerState,
  clock: ClockRead,
  options: { autoStart?: boolean } = {},
): boolean {
  state.generation += 1;
  state.tick = 0;
  state.status = options.autoStart ? 'running' : 'idle';
  state.startedAt = options.autoStart ? clock.wallNow : null;
  state.pausedAt = null;
  state.endedAt = null;
  state.cancelledAt = null;
  state.cancelReason = null;
  state.baseElapsedMilliseconds = 0;
  state.activeStartedAtMonotonic = options.autoStart ? clock.monotonicNow : null;
  state.now = clock.wallNow;
  return true;
}

export function restartTimerState(state: InternalTimerState, clock: ClockRead): boolean {
  return resetTimerState(state, clock, { autoStart: true });
}

export function cancelTimerState(state: InternalTimerState, clock: ClockRead, reason?: string): boolean {
  if (state.status !== 'running' && state.status !== 'paused') return false;

  state.baseElapsedMilliseconds = getElapsedMilliseconds(state, clock);
  state.activeStartedAtMonotonic = null;
  state.status = 'cancelled';
  state.cancelledAt = clock.wallNow;
  state.cancelReason = reason ?? null;
  state.now = clock.wallNow;
  return true;
}

export function endTimerState(state: InternalTimerState, clock: ClockRead): boolean {
  if (state.status !== 'running') return false;

  state.baseElapsedMilliseconds = getElapsedMilliseconds(state, clock);
  state.activeStartedAtMonotonic = null;
  state.status = 'ended';
  state.endedAt = clock.wallNow;
  state.now = clock.wallNow;
  return true;
}

export function tickTimerState(state: InternalTimerState, clock: ClockRead): boolean {
  if (state.status !== 'running') return false;

  state.tick += 1;
  state.now = clock.wallNow;
  return true;
}
