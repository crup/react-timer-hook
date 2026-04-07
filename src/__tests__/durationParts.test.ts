import { describe, expect, it } from 'vitest';
import { durationParts } from '../durationParts';

describe('durationParts', () => {
  it('decomposes zero', () => {
    expect(durationParts(0)).toEqual({
      totalMilliseconds: 0,
      totalSeconds: 0,
      milliseconds: 0,
      seconds: 0,
      minutes: 0,
      hours: 0,
      days: 0,
    });
  });

  it('decomposes duration parts', () => {
    expect(durationParts(1 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000 + 3 * 60 * 1000 + 4 * 1000 + 567)).toEqual({
      totalMilliseconds: 93784567,
      totalSeconds: 93784,
      milliseconds: 567,
      seconds: 4,
      minutes: 3,
      hours: 2,
      days: 1,
    });
  });

  it('clamps negative and truncates fractional input', () => {
    expect(durationParts(-100).totalMilliseconds).toBe(0);
    expect(durationParts(1234.9).totalMilliseconds).toBe(1234);
  });

  it('handles large finite values', () => {
    expect(durationParts(10 * 24 * 60 * 60 * 1000).days).toBe(10);
  });
});
