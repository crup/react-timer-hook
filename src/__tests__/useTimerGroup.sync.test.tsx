import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTimerGroup } from '../useTimerGroup';

describe('useTimerGroup sync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('preserves state for existing ids and removes missing ids', () => {
    const { result, rerender } = renderHook(({ items }) => useTimerGroup({ updateIntervalMs: 100, items }), {
      initialProps: { items: [{ id: 'a', autoStart: true }, { id: 'b', autoStart: true }] },
    });

    act(() => vi.advanceTimersByTime(100));
    expect(result.current.get('a')?.tick).toBe(1);

    rerender({ items: [{ id: 'a', autoStart: true }] });

    expect(result.current.get('a')?.tick).toBe(1);
    expect(result.current.get('b')).toBeUndefined();
  });

  it('updates endWhen without resetting state', () => {
    const { result, rerender } = renderHook(({ shouldEnd }) =>
      useTimerGroup({
        updateIntervalMs: 100,
        items: [{ id: 'a', autoStart: true, endWhen: () => shouldEnd }],
      }),
      { initialProps: { shouldEnd: false } },
    );

    act(() => vi.advanceTimersByTime(100));
    expect(result.current.get('a')?.tick).toBe(1);

    rerender({ shouldEnd: true });
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.get('a')?.status).toBe('ended');
  });

  it('uses new item callbacks after a controlled items rerender', () => {
    const firstEnd = vi.fn();
    const secondEnd = vi.fn();
    const { result, rerender } = renderHook(({ onEnd }) =>
      useTimerGroup({
        updateIntervalMs: 100,
        items: [{ id: 'a', autoStart: true, endWhen: snapshot => snapshot.elapsedMilliseconds >= 200, onEnd }],
      }),
      { initialProps: { onEnd: firstEnd } },
    );

    act(() => vi.advanceTimersByTime(100));
    expect(result.current.get('a')?.tick).toBe(1);

    rerender({ onEnd: secondEnd });
    act(() => vi.advanceTimersByTime(100));

    expect(firstEnd).not.toHaveBeenCalled();
    expect(secondEnd).toHaveBeenCalledTimes(1);
  });

  it('uses guarded controls for stale item onEnd callbacks after restart', () => {
    let staleCancel!: () => void;
    const { result } = renderHook(() =>
      useTimerGroup({
        updateIntervalMs: 100,
        items: [
          {
            id: 'a',
            autoStart: true,
            endWhen: snapshot => snapshot.elapsedMilliseconds >= 100,
            onEnd: (_snapshot, controls) => {
              staleCancel = () => controls.cancel('stale-end');
            },
          },
        ],
      }),
    );

    act(() => vi.advanceTimersByTime(100));
    expect(result.current.get('a')?.status).toBe('ended');

    act(() => result.current.restart('a'));
    act(() => staleCancel());

    expect(result.current.get('a')?.status).toBe('running');
    expect(result.current.get('a')?.cancelReason).toBeNull();
  });

  it('reschedules controlled item schedules when cadence changes', async () => {
    const callback = vi.fn();
    const { rerender } = renderHook(({ everyMs }) =>
      useTimerGroup({
        updateIntervalMs: 1000,
        items: [
          {
            id: 'a',
            autoStart: true,
            schedules: [{ id: 'poll', everyMs, callback }],
          },
        ],
      }),
      { initialProps: { everyMs: 1000 } },
    );

    rerender({ everyMs: 100 });
    act(() => vi.advanceTimersByTime(100));
    await act(async () => {});

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('uses the subscribed group clock for get snapshots in a render', () => {
    const { result } = renderHook(() =>
      useTimerGroup({
        updateIntervalMs: 100,
        items: [{ id: 'a', autoStart: true }],
      }),
    );

    act(() => vi.advanceTimersByTime(100));

    expect(result.current.get('a')?.now).toBe(result.current.now);
  });
});
