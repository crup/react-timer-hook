import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTimerGroup } from '../useTimerGroup';

describe('useTimerGroup lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('manages keyed timers independently', () => {
    const { result } = renderHook(() =>
      useTimerGroup({
        updateIntervalMs: 100,
        items: [
          { id: 'a', autoStart: true },
          { id: 'b', autoStart: false },
        ],
      }),
    );

    expect(result.current.get('a')?.status).toBe('running');
    expect(result.current.get('b')?.status).toBe('idle');

    act(() => result.current.start('b'));
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.get('a')?.tick).toBe(1);
    expect(result.current.get('b')?.tick).toBe(1);

    act(() => result.current.pause('a'));
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.get('a')?.tick).toBe(1);
    expect(result.current.get('b')?.tick).toBe(2);
  });

  it('ends each item once and cancel does not end', () => {
    const onEndA = vi.fn();
    const onEndB = vi.fn();
    const { result } = renderHook(() =>
      useTimerGroup({
        updateIntervalMs: 100,
        items: [
          { id: 'a', autoStart: true, endWhen: snapshot => snapshot.elapsedMilliseconds >= 100, onEnd: onEndA },
          { id: 'b', autoStart: true, endWhen: snapshot => snapshot.elapsedMilliseconds >= 100, onEnd: onEndB },
        ],
      }),
    );

    act(() => result.current.cancel('b', 'manual'));
    act(() => vi.advanceTimersByTime(500));

    expect(onEndA).toHaveBeenCalledTimes(1);
    expect(onEndB).not.toHaveBeenCalled();
    expect(result.current.get('b')?.cancelReason).toBe('manual');
  });

  it('supports add, update, remove, clear, and duplicate validation', () => {
    const { result } = renderHook(() => useTimerGroup({ updateIntervalMs: 100 }));

    act(() => result.current.add({ id: 'a' }));
    expect(result.current.get('a')).toBeDefined();

    act(() => result.current.update('a', { autoStart: true }));
    expect(result.current.get('a')).toBeDefined();

    act(() => result.current.remove('a'));
    expect(result.current.get('a')).toBeUndefined();

    act(() => result.current.add({ id: 'a' }));
    expect(() => act(() => result.current.add({ id: 'a' }))).toThrow();

    act(() => result.current.clear());
    expect(result.current.size).toBe(0);
  });
});
