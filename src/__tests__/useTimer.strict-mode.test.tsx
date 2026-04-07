import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTimer } from '../useTimer';

describe('useTimer rerender and Strict Mode behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rerenders do not create extra ticks', () => {
    const { result, rerender } = renderHook(() => useTimer({ autoStart: true, updateIntervalMs: 100 }));

    rerender();
    rerender();
    rerender();
    act(() => vi.advanceTimersByTime(100));

    expect(result.current.tick).toBe(1);
  });

  it('keeps control method identities stable across rerenders and ticks', () => {
    const { result, rerender } = renderHook(() => useTimer({ autoStart: true, updateIntervalMs: 100 }));
    const controls = {
      start: result.current.start,
      pause: result.current.pause,
      resume: result.current.resume,
      reset: result.current.reset,
      restart: result.current.restart,
      cancel: result.current.cancel,
    };

    rerender();
    act(() => vi.advanceTimersByTime(100));

    expect(result.current.start).toBe(controls.start);
    expect(result.current.pause).toBe(controls.pause);
    expect(result.current.resume).toBe(controls.resume);
    expect(result.current.reset).toBe(controls.reset);
    expect(result.current.restart).toBe(controls.restart);
    expect(result.current.cancel).toBe(controls.cancel);
  });

  it('does not delay the active timeout on parent rerender', () => {
    const { result, rerender } = renderHook(() => useTimer({ autoStart: true, updateIntervalMs: 100 }));

    act(() => vi.advanceTimersByTime(50));
    rerender();
    act(() => vi.advanceTimersByTime(50));

    expect(result.current.tick).toBe(1);
  });

  it('Strict Mode does not duplicate onEnd', () => {
    const onEnd = vi.fn();
    renderHook(
      () =>
        useTimer({
          autoStart: true,
          updateIntervalMs: 100,
          endWhen: snapshot => snapshot.elapsedMilliseconds >= 100,
          onEnd,
        }),
      { wrapper: React.StrictMode },
    );

    act(() => vi.advanceTimersByTime(500));
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('cleans up on unmount', () => {
    const { unmount } = renderHook(() => useTimer({ autoStart: true, updateIntervalMs: 100 }));

    unmount();
    expect(() => act(() => vi.advanceTimersByTime(500))).not.toThrow();
  });
});
