import { describe, expect, it } from 'vitest';
import {
  cancelTimerState,
  createTimerState,
  endTimerState,
  pauseTimerState,
  resetTimerState,
  restartTimerState,
  resumeTimerState,
  startTimerState,
  toSnapshot,
} from '../state';

const clock = (time: number) => ({ wallNow: time, monotonicNow: time });

describe('timer state transitions', () => {
  it('starts idle and starts from idle', () => {
    const state = createTimerState(clock(0));
    expect(toSnapshot(state, clock(0)).isIdle).toBe(true);

    expect(startTimerState(state, clock(10))).toBe(true);
    expect(toSnapshot(state, clock(10)).isRunning).toBe(true);
    expect(startTimerState(state, clock(20))).toBe(false);
  });

  it('pauses and resumes with elapsed time excluding paused duration', () => {
    const state = createTimerState(clock(0));
    startTimerState(state, clock(0));
    pauseTimerState(state, clock(100));

    expect(toSnapshot(state, clock(1000)).elapsedMilliseconds).toBe(100);
    expect(resumeTimerState(state, clock(1000))).toBe(true);
    expect(toSnapshot(state, clock(1100)).elapsedMilliseconds).toBe(200);
  });

  it('start from paused is a no-op', () => {
    const state = createTimerState(clock(0));
    startTimerState(state, clock(0));
    pauseTimerState(state, clock(100));

    expect(startTimerState(state, clock(200))).toBe(false);
    expect(state.status).toBe('paused');
  });

  it('reset and restart create new generations', () => {
    const state = createTimerState(clock(0));
    startTimerState(state, clock(0));
    resetTimerState(state, clock(100));

    expect(state.status).toBe('idle');
    expect(state.generation).toBe(1);

    restartTimerState(state, clock(200));
    expect(state.status).toBe('running');
    expect(state.generation).toBe(2);
  });

  it('cancel and end are terminal until reset or restart', () => {
    const cancelled = createTimerState(clock(0));
    startTimerState(cancelled, clock(0));
    expect(cancelTimerState(cancelled, clock(10), 'user')).toBe(true);
    expect(startTimerState(cancelled, clock(20))).toBe(false);
    expect(cancelled.cancelReason).toBe('user');

    const ended = createTimerState(clock(0));
    startTimerState(ended, clock(0));
    expect(endTimerState(ended, clock(10))).toBe(true);
    expect(startTimerState(ended, clock(20))).toBe(false);
  });

  it('does not cancel an idle timer', () => {
    const state = createTimerState(clock(0));

    expect(cancelTimerState(state, clock(10), 'idle')).toBe(false);
    expect(state.status).toBe('idle');
  });
});
