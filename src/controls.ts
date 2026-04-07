import type { TimerControls } from './types';

export function guardTimerControls<TControls extends TimerControls>(
  controls: TControls,
  isLive: () => boolean,
): TControls {
  return {
    start: () => {
      if (isLive()) controls.start();
    },
    pause: () => {
      if (isLive()) controls.pause();
    },
    resume: () => {
      if (isLive()) controls.resume();
    },
    reset: options => {
      if (isLive()) controls.reset(options);
    },
    restart: () => {
      if (isLive()) controls.restart();
    },
    cancel: reason => {
      if (isLive()) controls.cancel(reason);
    },
  } as TControls;
}
