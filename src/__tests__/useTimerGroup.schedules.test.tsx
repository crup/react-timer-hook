import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTimerGroup } from '../useTimerGroup';

describe('useTimerGroup schedules and debug', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs item schedules independently and includes timer id in debug logs', async () => {
    const callback = vi.fn();
    const logger = vi.fn();
    renderHook(() =>
      useTimerGroup({
        updateIntervalMs: 100,
        debug: { logger },
        items: [
          {
            id: 'a',
            autoStart: true,
            schedules: [{ id: 'poll', everyMs: 100, callback }],
          },
        ],
      }),
    );

    act(() => vi.advanceTimersByTime(100));
    await act(async () => {});

    expect(callback).toHaveBeenCalledTimes(1);
    expect(logger).toHaveBeenCalledWith(expect.objectContaining({ type: 'schedule:start', timerId: 'a', scheduleId: 'poll' }));
  });

  it('passes schedule timing context to item callbacks and debug logs', async () => {
    const callback = vi.fn();
    const logger = vi.fn();
    renderHook(() =>
      useTimerGroup({
        updateIntervalMs: 100,
        debug: { logger },
        items: [
          {
            id: 'a',
            autoStart: true,
            schedules: [{ id: 'poll', everyMs: 100, callback }],
          },
        ],
      }),
    );

    act(() => vi.advanceTimersByTime(100));
    await act(async () => {});

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ now: 100 }),
      expect.objectContaining({ cancel: expect.any(Function) }),
      {
        scheduleId: 'poll',
        scheduledAt: 100,
        firedAt: 100,
        nextRunAt: 200,
        overdueCount: 0,
        effectiveEveryMs: 100,
      },
    );
    expect(logger).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'schedule:start',
        timerId: 'a',
        scheduleId: 'poll',
        scheduledAt: 100,
        firedAt: 100,
        nextRunAt: 200,
        overdueCount: 0,
        effectiveEveryMs: 100,
      }),
    );
  });

  it('drives many timers with one cadence', () => {
    const items = Array.from({ length: 100 }, (_, index) => ({ id: String(index), autoStart: true }));
    const { result } = renderHook(() => useTimerGroup({ updateIntervalMs: 100, items }));

    act(() => vi.advanceTimersByTime(100));
    expect(result.current.get('0')?.tick).toBe(1);
    expect(result.current.get('99')?.tick).toBe(1);
  });

  it('keeps group control method identities stable across rerenders and ticks', () => {
    const items = [{ id: 'a', autoStart: true }];
    const { result, rerender } = renderHook(() => useTimerGroup({ updateIntervalMs: 100, items }));
    const controls = {
      start: result.current.start,
      pause: result.current.pause,
      resume: result.current.resume,
      reset: result.current.reset,
      restart: result.current.restart,
      cancel: result.current.cancel,
      pauseAll: result.current.pauseAll,
      resumeAll: result.current.resumeAll,
      restartAll: result.current.restartAll,
    };

    rerender();
    act(() => vi.advanceTimersByTime(100));

    expect(result.current.start).toBe(controls.start);
    expect(result.current.pause).toBe(controls.pause);
    expect(result.current.resume).toBe(controls.resume);
    expect(result.current.reset).toBe(controls.reset);
    expect(result.current.restart).toBe(controls.restart);
    expect(result.current.cancel).toBe(controls.cancel);
    expect(result.current.pauseAll).toBe(controls.pauseAll);
    expect(result.current.resumeAll).toBe(controls.resumeAll);
    expect(result.current.restartAll).toBe(controls.restartAll);
  });
});
