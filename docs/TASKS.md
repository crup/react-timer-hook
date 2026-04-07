# Task Plan

This file breaks the project into implementation-ready tasks. Each task should be small enough for a lower-capability coding model to implement with tests.

Do not skip tests. This library exists to be more correct than timer hooks that fail under rerender, Strict Mode, async callbacks, and many active timers.

## Phase 0: Project Setup

Objective: create a TypeScript React library scaffold.

Tasks:

- Choose the package manager and lockfile. Recommendation: `pnpm`.
- Add TypeScript.
- Add React and React DOM as peer dependencies.
- Add React and React DOM as dev dependencies for tests.
- Add Vitest.
- Add React Testing Library.
- Add a library bundler. Recommendation: `tsup` for v1.
- Add scripts:
  - `test`
  - `test:watch`
  - `typecheck`
  - `build`
  - `lint` if linting is added
  - `docs:build`
- Set `sideEffects: false` in `package.json`.
- Configure exports for ESM, CJS, and types unless the project chooses ESM-only.

Acceptance criteria:

- `pnpm test` runs.
- `pnpm typecheck` runs.
- `pnpm build` runs.
- No hook implementation is required in this phase.

## Phase 1: Pure Types and Duration Utility

Objective: add shared types and a pure duration decomposition helper.

Files:

- `src/types.ts`
- `src/durationParts.ts`
- `src/index.ts`
- `src/__tests__/durationParts.test.ts`

Tests:

- decomposes `0`
- decomposes milliseconds
- decomposes seconds
- decomposes minutes
- decomposes hours
- decomposes days
- clamps negative values to zero
- truncates fractional milliseconds
- handles large finite values

Acceptance criteria:

- `durationParts` has no React dependency.
- It returns numbers only.
- It does not pad strings.
- It does not format.
- It does not apply timezone logic.

## Phase 2: Clock Helpers

Objective: add wall-clock and monotonic clock helpers.

Files:

- `src/clocks.ts`
- `src/__tests__/clocks.test.ts`

Tests:

- returns a wall timestamp
- uses `performance.now()` when available
- falls back to `Date.now()` when `performance.now()` is unavailable
- does not touch `window` during module import

Acceptance criteria:

- SSR-safe module import.
- No browser-only global assumptions.

## Phase 3: Timer State Transitions

Objective: implement pure state transitions before React integration.

Files:

- `src/state.ts`
- `src/__tests__/state.test.ts`

Tests:

- initial state is idle
- `start` from idle transitions to running
- `start` from running is no-op
- `start` from paused is no-op
- `pause` from running freezes elapsed
- `pause` from idle is no-op
- `resume` from paused resumes elapsed
- `reset` increments generation and clears terminal fields
- `reset({ autoStart: true })` starts
- `restart` resets and starts
- `cancel` does not call end behavior
- `end` is terminal
- ended and cancelled states require reset or restart for a new generation

Acceptance criteria:

- Transition helpers are deterministic and easy to test.
- No React or timeout usage in state transition tests.

## Phase 4: `useTimer` Lifecycle

Objective: implement the single timer hook without schedules first.

Files:

- `src/useTimer.ts`
- `src/__tests__/useTimer.lifecycle.test.tsx`

Tests:

- `autoStart: false` starts idle
- `autoStart: true` starts running after mount
- `start` begins ticking
- `pause` stops ticking and freezes active elapsed
- `resume` continues active elapsed from paused duration
- `reset` returns idle with zero elapsed
- `restart` resets and starts
- `endWhen` ends timer
- `onEnd` fires once
- async `onEnd` fires once while pending
- `cancel` prevents `onEnd`
- `restart` after ended allows `onEnd` again for the new generation
- invalid `updateIntervalMs` throws `RangeError`

Acceptance criteria:

- Uses recursive `setTimeout`.
- Does not use `setInterval`.
- Does not schedule during render.
- Works with fake timers.

## Phase 5: Rerender, Strict Mode, and Cleanup

Objective: prove the hook is React-safe.

Files:

- `src/__tests__/useTimer.strict-mode.test.tsx`
- `src/__tests__/useTimer.cleanup.test.tsx`

Tests:

- rerendering many times does not create extra ticks
- changing callback identity does not restart the timer loop
- changing `updateIntervalMs` does not create duplicate loops
- Strict Mode does not duplicate `onEnd`
- Strict Mode does not duplicate schedule-free ticks
- unmount clears timeout
- unmount prevents state updates after async callbacks resolve

Acceptance criteria:

- Tests would fail if `setTimeout` is called on every render without cleanup.
- No console errors about state updates after unmount.

## Phase 6: Schedules

Objective: add app-owned scheduled side effects.

Files:

- `src/useTimer.ts`
- `src/schedules.ts` if useful
- `src/__tests__/useTimer.schedules.test.tsx`

Tests:

- schedule runs after `everyMs`
- schedule does not run while idle
- schedule does not run while paused
- schedule resumes after `resume`
- `leading: true` runs when active
- `overlap: 'skip'` skips while async callback is pending
- `overlap: 'allow'` allows overlap
- schedule callback receives snapshot and controls
- schedule can call `cancel`
- schedule can call `restart`
- stale async schedule cannot affect a new generation
- invalid `everyMs` throws `RangeError`

Acceptance criteria:

- Schedule callbacks are not used to drive the main timer tick.
- Slow async schedules do not pile up by default.

## Phase 7: Debug Logs

Objective: add opt-in semantic debug logging.

Files:

- `src/debug.ts`
- `src/__tests__/useTimer.debug.test.tsx`

Tests:

- no logs by default
- `debug: true` logs via `console.debug`
- `debug: fn` calls the function
- `debug: { enabled: false }` does not log
- `debug: { logger, includeTicks: false }` suppresses tick logs
- `debug: { logger, includeTicks: true }` includes tick logs
- logs include generation, tick, status, now, elapsedMilliseconds
- logs do not include raw timeout handles
- schedule skip emits `schedule:skip`
- callback rejection emits `schedule:error` or `callback:error`

Acceptance criteria:

- Debug logs are useful for diagnosing lifecycle issues.
- Debug logs are fully opt-in.
- No production logs appear unless user explicitly enables debug.

## Phase 8: `useTimerGroup`

Objective: add many keyed independent timers with one scheduler.

Files:

- `src/useTimerGroup.ts`
- `src/__tests__/useTimerGroup.lifecycle.test.tsx`
- `src/__tests__/useTimerGroup.sync.test.tsx`
- `src/__tests__/useTimerGroup.schedules.test.tsx`

Tests:

- initializes empty group
- adds item from `items`
- starts new item when `autoStart` is true
- existing id preserves lifecycle state across rerender
- changing `endWhen` updates future behavior without resetting state
- removed id is cleaned up
- duplicate ids throw predictable error
- `get` returns undefined for missing id
- `start`, `pause`, `resume`, `reset`, `restart`, `cancel` work per id
- `startAll`, `pauseAll`, `resumeAll`, `resetAll`, `restartAll`, `cancelAll` work
- one scheduler drives many running items
- each item has independent `onEnd`
- async `onEnd` is once-only per item generation
- item cancel does not call `onEnd`
- removing item prevents stale async schedule effects
- group debug logs include `timerId`

Acceptance criteria:

- No per-item timeout loops.
- Group remains performant with at least 100 items in tests.
- Removed items do not leak schedule state.

## Phase 9: Documentation Examples

Objective: document correct derivation patterns.

Files:

- `README.md`
- `docs/API.md`
- `docs/RECIPES.md` if created later

Examples:

- stopwatch
- absolute deadline countdown
- pausable duration countdown
- clock
- API polling schedule
- many independent timers
- debug logger

Acceptance criteria:

- No examples use timezone or formatting helpers from the library.
- No examples use countdown/stopwatch/clock mode enums.
- Examples compile against public API types.

## Phase 10: Release Readiness

Objective: prepare the project for OSS release.

Tasks:

- Add `LICENSE`.
- Add `CONTRIBUTING.md`.
- Add issue templates.
- Add PR template.
- Add CI workflow.
- Add docs workflow.
- Add release workflow.
- Add Changesets or equivalent semver automation.
- Add package provenance if supported.
- Add docs site generation.
- Add README generation or validation.

Acceptance criteria:

- PRs run tests, typecheck, and build.
- Merges to main can create release PRs.
- Releases publish only after CI passes.
- Docs deploy from main.
