import { describe, expect, it, vi } from 'vitest';
import { readClock } from '../clocks';

describe('readClock', () => {
  it('returns wall-clock and monotonic timestamps', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    vi.spyOn(performance, 'now').mockReturnValue(50);

    expect(readClock()).toEqual({ wallNow: 1000, monotonicNow: 50 });
  });

  it('falls back to Date.now when performance.now is unavailable', () => {
    vi.spyOn(Date, 'now').mockReturnValue(2000);
    const original = globalThis.performance;
    Object.defineProperty(globalThis, 'performance', {
      configurable: true,
      value: undefined,
    });

    expect(readClock()).toEqual({ wallNow: 2000, monotonicNow: 2000 });

    Object.defineProperty(globalThis, 'performance', {
      configurable: true,
      value: original,
    });
  });
});
