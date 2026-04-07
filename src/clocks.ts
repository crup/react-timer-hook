export type ClockRead = {
  wallNow: number;
  monotonicNow: number;
};

export function readClock(): ClockRead {
  const wallNow = Date.now();
  const monotonicNow =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : wallNow;

  return { wallNow, monotonicNow };
}

export function validatePositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite number greater than 0`);
  }
}
