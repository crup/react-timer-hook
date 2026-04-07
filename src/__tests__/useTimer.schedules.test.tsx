import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScheduledTimer as useTimer } from '../scheduledTimer';

describe('useTimer schedules', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs schedules on cadence only while running', async () => {
    const callback = vi.fn();
    const { result } = renderHook(() =>
      useTimer({
        updateIntervalMs: 100,
        schedules: [{ everyMs: 200, callback }],
      }),
    );

    act(() => vi.advanceTimersByTime(500));
    expect(callback).not.toHaveBeenCalled();

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(100));
    act(() => vi.advanceTimersByTime(100));
    await act(async () => {});
    expect(callback).toHaveBeenCalledTimes(1);

    act(() => result.current.pause());
    act(() => vi.advanceTimersByTime(500));
    await act(async () => {});
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('supports leading schedules and controls', async () => {
    const callback = vi.fn((_snapshot, controls) => controls.cancel('scheduled'));
    const { result } = renderHook(() =>
      useTimer({
        updateIntervalMs: 100,
        schedules: [{ everyMs: 1000, leading: true, callback }],
      }),
    );

    act(() => result.current.start());
    await act(async () => {});

    expect(callback).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('cancelled');
  });

  it('skips overlapping async schedules by default', async () => {
    let resolveSchedule!: () => void;
    const callback = vi.fn(
      () =>
        new Promise<void>(resolve => {
          resolveSchedule = resolve;
        }),
    );

    renderHook(() =>
      useTimer({
        autoStart: true,
        updateIntervalMs: 100,
        schedules: [{ everyMs: 100, callback }],
      }),
    );

    act(() => vi.advanceTimersByTime(100));
    await act(async () => {});
    act(() => vi.advanceTimersByTime(500));
    await act(async () => {});

    expect(callback).toHaveBeenCalledTimes(1);
    act(() => resolveSchedule());
    await act(async () => {});
  });

  it('allows overlap when configured', async () => {
    const callback = vi.fn(() => new Promise<void>(() => {}));

    renderHook(() =>
      useTimer({
        autoStart: true,
        updateIntervalMs: 100,
        schedules: [{ everyMs: 100, overlap: 'allow', callback }],
      }),
    );

    act(() => vi.advanceTimersByTime(100));
    act(() => vi.advanceTimersByTime(100));
    act(() => vi.advanceTimersByTime(100));
    await act(async () => {});
    expect(callback).toHaveBeenCalledTimes(3);
  });

  it('uses the latest schedule callback without restarting the timer', async () => {
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();
    const { rerender } = renderHook(({ callback }) =>
      useTimer({
        autoStart: true,
        updateIntervalMs: 100,
        schedules: [{ id: 'poll', everyMs: 100, callback }],
      }),
      { initialProps: { callback: firstCallback } },
    );

    rerender({ callback: secondCallback });
    act(() => vi.advanceTimersByTime(100));
    await act(async () => {});

    expect(firstCallback).not.toHaveBeenCalled();
    expect(secondCallback).toHaveBeenCalledTimes(1);
  });

  it('checks schedule cadence independently from render update interval', async () => {
    const callback = vi.fn();
    renderHook(() =>
      useTimer({
        autoStart: true,
        updateIntervalMs: 1000,
        schedules: [{ id: 'fast-poll', everyMs: 100, callback }],
      }),
    );

    act(() => vi.advanceTimersByTime(100));
    await act(async () => {});

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('passes schedule timing context to callbacks', async () => {
    const callback = vi.fn();
    renderHook(() =>
      useTimer({
        autoStart: true,
        updateIntervalMs: 100,
        schedules: [{ id: 'poll', everyMs: 100, callback }],
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
  });

  it('reports overdue intervals when a scheduled timeout fires late', async () => {
    const callback = vi.fn();
    renderHook(() =>
      useTimer({
        autoStart: true,
        updateIntervalMs: 1000,
        schedules: [{ id: 'poll', everyMs: 100, leading: true, callback }],
      }),
    );

    await act(async () => {});
    callback.mockClear();

    act(() => vi.setSystemTime(350));
    act(() => vi.advanceTimersByTime(100));
    await act(async () => {});

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ now: 450 }),
      expect.anything(),
      {
        scheduleId: 'poll',
        scheduledAt: 400,
        firedAt: 450,
        nextRunAt: 500,
        overdueCount: 3,
        effectiveEveryMs: 100,
      },
    );
  });

  it('emits schedule timing context in diagnostics', async () => {
    const logger = vi.fn();
    renderHook(() =>
      useTimer({
        autoStart: true,
        updateIntervalMs: 100,
        diagnostics: { logger },
        schedules: [{ id: 'poll', everyMs: 100, callback: vi.fn() }],
      }),
    );

    act(() => vi.advanceTimersByTime(100));
    await act(async () => {});

    expect(logger).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'schedule:start',
        scheduleId: 'poll',
        scheduledAt: 100,
        firedAt: 100,
        nextRunAt: 200,
        overdueCount: 0,
        effectiveEveryMs: 100,
      }),
    );
  });

  it('routes async onEnd rejections to diagnostics', async () => {
    const logger = vi.fn();
    renderHook(() =>
      useTimer({
        autoStart: true,
        updateIntervalMs: 100,
        diagnostics: { logger },
        endWhen: snapshot => snapshot.elapsedMilliseconds >= 100,
        onEnd: () => Promise.reject(new Error('boom')),
      }),
    );

    act(() => vi.advanceTimersByTime(100));
    await act(async () => {});

    expect(logger).toHaveBeenCalledWith(expect.objectContaining({ type: 'callback:error' }));
  });
});
