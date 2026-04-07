import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScheduledTimer as useTimer } from '../scheduledTimer';

describe('useTimer debug', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not log by default', () => {
    const consoleDebug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const { result } = renderHook(() => useTimer({ updateIntervalMs: 100 }));

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(100));

    expect(consoleDebug).not.toHaveBeenCalled();
  });

  it('logs semantic events when enabled', () => {
    const logger = vi.fn();
    const { result } = renderHook(() =>
      useTimer({
        updateIntervalMs: 100,
        debug: { logger, includeTicks: true, label: 'test' },
      }),
    );

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(100));

    expect(logger).toHaveBeenCalledWith(expect.objectContaining({ type: 'timer:start', label: 'test' }));
    expect(logger).toHaveBeenCalledWith(expect.objectContaining({ type: 'timer:tick', generation: 0, tick: 1 }));
    expect(JSON.stringify(logger.mock.calls)).not.toContain('Timeout');
  });

  it('suppresses tick logs unless includeTicks is true', () => {
    const logger = vi.fn();
    const { result } = renderHook(() =>
      useTimer({
        updateIntervalMs: 100,
        debug: { logger },
      }),
    );

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(100));

    expect(logger.mock.calls.some(([event]) => event.type === 'timer:tick')).toBe(false);
  });
});
