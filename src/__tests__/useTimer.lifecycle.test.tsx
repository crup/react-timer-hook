import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTimer } from '../useTimer';

describe('useTimer lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts idle by default and can start ticking', () => {
    const { result } = renderHook(() => useTimer({ updateIntervalMs: 1000 }));

    expect(result.current.status).toBe('idle');
    act(() => result.current.start());
    expect(result.current.status).toBe('running');

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.tick).toBe(1);
  });

  it('auto starts after mount', () => {
    const { result } = renderHook(() => useTimer({ autoStart: true, updateIntervalMs: 1000 }));

    expect(result.current.status).toBe('running');
  });

  it('pauses, resumes, resets, and restarts', () => {
    const { result } = renderHook(() => useTimer({ autoStart: true, updateIntervalMs: 100 }));

    act(() => vi.advanceTimersByTime(100));
    act(() => result.current.pause());
    const elapsedAtPause = result.current.elapsedMilliseconds;
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.elapsedMilliseconds).toBe(elapsedAtPause);

    act(() => result.current.resume());
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.elapsedMilliseconds).toBeGreaterThan(elapsedAtPause);

    act(() => result.current.reset());
    expect(result.current.status).toBe('idle');
    expect(result.current.elapsedMilliseconds).toBe(0);

    act(() => result.current.restart());
    expect(result.current.status).toBe('running');
  });

  it('ends once and can restart into a new generation', () => {
    const onEnd = vi.fn();
    const { result } = renderHook(() =>
      useTimer({
        autoStart: true,
        updateIntervalMs: 100,
        endWhen: snapshot => snapshot.elapsedMilliseconds >= 100,
        onEnd,
      }),
    );

    act(() => vi.advanceTimersByTime(500));
    expect(result.current.status).toBe('ended');
    expect(onEnd).toHaveBeenCalledTimes(1);

    act(() => result.current.restart());
    act(() => vi.advanceTimersByTime(100));
    expect(onEnd).toHaveBeenCalledTimes(2);
  });

  it('checks end conditions immediately on start', () => {
    const onEnd = vi.fn();
    const { result } = renderHook(() =>
      useTimer({
        updateIntervalMs: 100,
        endWhen: snapshot => snapshot.now >= 0,
        onEnd,
      }),
    );

    act(() => result.current.start());

    expect(result.current.status).toBe('ended');
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('does not call onEnd when cancelled', () => {
    const onEnd = vi.fn();
    const { result } = renderHook(() =>
      useTimer({
        autoStart: true,
        updateIntervalMs: 100,
        endWhen: snapshot => snapshot.elapsedMilliseconds >= 100,
        onEnd,
      }),
    );

    act(() => result.current.cancel('manual'));
    act(() => vi.advanceTimersByTime(500));

    expect(result.current.status).toBe('cancelled');
    expect(result.current.cancelReason).toBe('manual');
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('fires async onEnd once while pending', () => {
    let resolveEnd!: () => void;
    const onEnd = vi.fn(
      () =>
        new Promise<void>(resolve => {
          resolveEnd = resolve;
        }),
    );

    renderHook(() =>
      useTimer({
        autoStart: true,
        updateIntervalMs: 100,
        endWhen: snapshot => snapshot.elapsedMilliseconds >= 100,
        onEnd,
      }),
    );

    act(() => vi.advanceTimersByTime(500));
    expect(onEnd).toHaveBeenCalledTimes(1);
    act(() => resolveEnd());
  });

  it('throws for invalid update intervals', () => {
    expect(() => renderHook(() => useTimer({ updateIntervalMs: 0 }))).toThrow(RangeError);
  });
});
