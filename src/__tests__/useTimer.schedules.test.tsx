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

  it('reschedules immediately when schedule cadence changes', async () => {
    const callback = vi.fn();
    const { rerender } = renderHook(({ everyMs }) =>
      useTimer({
        autoStart: true,
        updateIntervalMs: 1000,
        schedules: [{ id: 'poll', everyMs, callback }],
      }),
      { initialProps: { everyMs: 1000 } },
    );

    rerender({ everyMs: 100 });
    act(() => vi.advanceTimersByTime(100));
    await act(async () => {});

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('restarts schedule cadence from the update time when cadence changes', async () => {
    const callback = vi.fn();
    const { rerender } = renderHook(({ everyMs }) =>
      useTimer({
        autoStart: true,
        updateIntervalMs: 1000,
        schedules: [{ id: 'poll', everyMs, callback }],
      }),
      { initialProps: { everyMs: 1000 } },
    );

    act(() => vi.advanceTimersByTime(500));
    rerender({ everyMs: 300 });
    act(() => vi.advanceTimersByTime(299));
    await act(async () => {});
    expect(callback).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    await act(async () => {});
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ now: 800 }),
      expect.anything(),
      expect.objectContaining({ scheduledAt: 800, overdueCount: 0 }),
    );
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

  it('routes schedule callback errors to schedule onError', async () => {
    const onError = vi.fn();
    renderHook(() =>
      useTimer({
        autoStart: true,
        updateIntervalMs: 100,
        schedules: [
          {
            id: 'poll',
            everyMs: 100,
            callback: () => Promise.reject(new Error('poll failed')),
            onError,
          },
        ],
      }),
    );

    act(() => vi.advanceTimersByTime(100));
    await act(async () => {});

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ status: 'running' }),
      expect.objectContaining({ cancel: expect.any(Function) }),
      expect.objectContaining({ scheduleId: 'poll' }),
    );
  });

  it('falls back to timer onError for schedule callback errors', async () => {
    const onError = vi.fn();
    renderHook(() =>
      useTimer({
        autoStart: true,
        updateIntervalMs: 100,
        onError,
        schedules: [
          {
            id: 'poll',
            everyMs: 100,
            callback: () => Promise.reject(new Error('poll failed')),
          },
        ],
      }),
    );

    act(() => vi.advanceTimersByTime(100));
    await act(async () => {});

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ status: 'running' }),
      expect.objectContaining({ cancel: expect.any(Function) }),
    );
  });

  it('prefers schedule onError over timer onError for schedule callback errors', async () => {
    const timerOnError = vi.fn();
    const scheduleOnError = vi.fn();
    renderHook(() =>
      useTimer({
        autoStart: true,
        updateIntervalMs: 100,
        onError: timerOnError,
        schedules: [
          {
            id: 'poll',
            everyMs: 100,
            callback: () => Promise.reject(new Error('poll failed')),
            onError: scheduleOnError,
          },
        ],
      }),
    );

    act(() => vi.advanceTimersByTime(100));
    await act(async () => {});

    expect(scheduleOnError).toHaveBeenCalledTimes(1);
    expect(timerOnError).not.toHaveBeenCalled();
  });

  it('ignores controls captured by stale schedule callbacks after restart', async () => {
    let staleCancel!: () => void;
    const { result } = renderHook(() =>
      useTimer({
        autoStart: true,
        updateIntervalMs: 100,
        schedules: [
          {
            id: 'poll',
            everyMs: 100,
            callback: (_snapshot, controls) => {
              staleCancel = () => controls.cancel('stale-schedule');
            },
          },
        ],
      }),
    );

    act(() => vi.advanceTimersByTime(100));
    await act(async () => {});

    act(() => result.current.restart());
    act(() => staleCancel());

    expect(result.current.status).toBe('running');
    expect(result.current.cancelReason).toBeNull();
  });

  it('throws for duplicate schedule ids', () => {
    expect(() =>
      renderHook(() =>
        useTimer({
          schedules: [
            { id: 'poll', everyMs: 100, callback: vi.fn() },
            { id: 'poll', everyMs: 200, callback: vi.fn() },
          ],
        }),
      ),
    ).toThrow('Duplicate schedule id "poll"');
  });
});
