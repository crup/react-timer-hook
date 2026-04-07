import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTimerGroup } from '../useTimerGroup';

describe('useTimerGroup schedules and diagnostics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs item schedules independently and includes timer id in diagnostics', async () => {
    const callback = vi.fn();
    const logger = vi.fn();
    renderHook(() =>
      useTimerGroup({
        updateIntervalMs: 100,
        diagnostics: { logger },
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

  it('passes schedule timing context to item callbacks and diagnostics', async () => {
    const callback = vi.fn();
    const logger = vi.fn();
    renderHook(() =>
      useTimerGroup({
        updateIntervalMs: 100,
        diagnostics: { logger },
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
    expect(logger).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'schedule:start',
        timerId: 'a',
        scheduleId: 'poll',
        scheduledAt: 100,
        firedAt: 100,
        nextRunAt: 200,
        overdueCount: 0,
        effectiveEveryMs: 100,
      }),
    );
  });

  it('starts newly added schedules from the update time', async () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useTimerGroup({ updateIntervalMs: 1000 }));

    act(() => result.current.add({ id: 'a', autoStart: true }));
    act(() => vi.advanceTimersByTime(50));
    act(() => result.current.update('a', { schedules: [{ id: 'poll', everyMs: 100, callback }] }));
    act(() => vi.advanceTimersByTime(99));
    await act(async () => {});
    expect(callback).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    await act(async () => {});
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ now: 150 }),
      expect.anything(),
      expect.objectContaining({ scheduledAt: 150, firedAt: 150 }),
    );
  });

  it('restarts controlled schedule cadence from the update time', async () => {
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

  it('routes schedule callback errors to item schedule onError', async () => {
    const onError = vi.fn();
    renderHook(() =>
      useTimerGroup({
        updateIntervalMs: 100,
        items: [
          {
            id: 'a',
            autoStart: true,
            schedules: [
              {
                id: 'poll',
                everyMs: 100,
                callback: () => Promise.reject(new Error('poll failed')),
                onError,
              },
            ],
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

  it('falls back to item onError for schedule callback errors', async () => {
    const onError = vi.fn();
    renderHook(() =>
      useTimerGroup({
        updateIntervalMs: 100,
        items: [
          {
            id: 'a',
            autoStart: true,
            onError,
            schedules: [
              {
                id: 'poll',
                everyMs: 100,
                callback: () => Promise.reject(new Error('poll failed')),
              },
            ],
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

  it('ignores controls captured by stale item schedules after restart', async () => {
    let staleCancel!: () => void;
    const { result } = renderHook(() =>
      useTimerGroup({
        updateIntervalMs: 100,
        items: [
          {
            id: 'a',
            autoStart: true,
            schedules: [
              {
                id: 'poll',
                everyMs: 100,
                callback: (_snapshot, controls) => {
                  staleCancel = () => controls.cancel('stale-schedule');
                },
              },
            ],
          },
        ],
      }),
    );

    act(() => vi.advanceTimersByTime(100));
    await act(async () => {});

    act(() => result.current.restart('a'));
    act(() => staleCancel());

    expect(result.current.get('a')?.status).toBe('running');
    expect(result.current.get('a')?.cancelReason).toBeNull();
  });

  it('throws for duplicate item schedule ids', () => {
    expect(() =>
      renderHook(() =>
        useTimerGroup({
          items: [
            {
              id: 'a',
              schedules: [
                { id: 'poll', everyMs: 100, callback: vi.fn() },
                { id: 'poll', everyMs: 200, callback: vi.fn() },
              ],
            },
          ],
        }),
      ),
    ).toThrow('Duplicate schedule id "poll"');
  });

  it('drives many timers with one cadence', () => {
    const items = Array.from({ length: 100 }, (_, index) => ({ id: String(index), autoStart: true }));
    const { result } = renderHook(() => useTimerGroup({ updateIntervalMs: 100, items }));

    act(() => vi.advanceTimersByTime(100));
    expect(result.current.get('0')?.tick).toBe(1);
    expect(result.current.get('99')?.tick).toBe(1);
  });

  it('keeps group control method identities stable across rerenders and ticks', () => {
    const items = [{ id: 'a', autoStart: true }];
    const { result, rerender } = renderHook(() => useTimerGroup({ updateIntervalMs: 100, items }));
    const controls = {
      start: result.current.start,
      pause: result.current.pause,
      resume: result.current.resume,
      reset: result.current.reset,
      restart: result.current.restart,
      cancel: result.current.cancel,
      pauseAll: result.current.pauseAll,
      resumeAll: result.current.resumeAll,
      restartAll: result.current.restartAll,
    };

    rerender();
    act(() => vi.advanceTimersByTime(100));

    expect(result.current.start).toBe(controls.start);
    expect(result.current.pause).toBe(controls.pause);
    expect(result.current.resume).toBe(controls.resume);
    expect(result.current.reset).toBe(controls.reset);
    expect(result.current.restart).toBe(controls.restart);
    expect(result.current.cancel).toBe(controls.cancel);
    expect(result.current.pauseAll).toBe(controls.pauseAll);
    expect(result.current.resumeAll).toBe(controls.resumeAll);
    expect(result.current.restartAll).toBe(controls.restartAll);
  });
});
