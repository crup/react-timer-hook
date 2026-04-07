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
});
