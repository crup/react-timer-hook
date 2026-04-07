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
