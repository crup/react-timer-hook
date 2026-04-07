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

  it('drives many timers with one cadence', () => {
    const items = Array.from({ length: 100 }, (_, index) => ({ id: String(index), autoStart: true }));
    const { result } = renderHook(() => useTimerGroup({ updateIntervalMs: 100, items }));

    act(() => vi.advanceTimersByTime(100));
    expect(result.current.get('0')?.tick).toBe(1);
    expect(result.current.get('99')?.tick).toBe(1);
  });
});
