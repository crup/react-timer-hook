import type { DurationParts } from './types';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function durationParts(milliseconds: number): DurationParts {
  const totalMilliseconds = Math.max(0, Math.trunc(Number.isFinite(milliseconds) ? milliseconds : 0));
  const days = Math.floor(totalMilliseconds / DAY);
  const afterDays = totalMilliseconds % DAY;
  const hours = Math.floor(afterDays / HOUR);
  const afterHours = afterDays % HOUR;
  const minutes = Math.floor(afterHours / MINUTE);
  const afterMinutes = afterHours % MINUTE;
  const seconds = Math.floor(afterMinutes / SECOND);

  return {
    totalMilliseconds,
    totalSeconds: Math.floor(totalMilliseconds / SECOND),
    milliseconds: afterMinutes % SECOND,
    seconds,
    minutes,
    hours,
    days,
  };
}
