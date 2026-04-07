# Agent Task Cards

Use these task cards with smaller coding models. Each card has a narrow objective, expected files, tests, and non-goals.

General instruction for every agent:

- Read `REQUIREMENTS.md`, `docs/API.md`, and the relevant section of `docs/IMPLEMENTATION.md`.
- Do not add countdown/stopwatch/clock mode enums.
- Do not add formatting, timezone, or `ampm` fields.
- Do not expose raw timeout handles.
- Use tests first.
- Keep debug logging opt-in.

## Card 1: Project Setup

Objective: set up the TypeScript library scaffold.

Expected files:

- `package.json`
- `tsconfig.json`
- `tsup.config.ts` or equivalent
- `vitest.config.ts`
- `src/index.ts`

Tests:

- Add a placeholder test only if needed to prove Vitest runs.

Non-goals:

- Do not implement hooks.
- Do not add docs site yet.

Acceptance criteria:

- `pnpm test` works.
- `pnpm typecheck` works.
- `pnpm build` works.

## Card 2: Duration Parts Utility

Objective: implement `durationParts`.

Expected files:

- `src/durationParts.ts`
- `src/types.ts`
- `src/index.ts`
- `src/__tests__/durationParts.test.ts`

Tests:

- zero
- negative clamp
- fractional truncation
- milliseconds
- seconds
- minutes
- hours
- days

Non-goals:

- No React.
- No formatting.
- No timezone.

Acceptance criteria:

- Pure function.
- Exported from `src/index.ts`.

## Card 3: Clock Helpers

Objective: implement wall-clock and monotonic clock helpers.

Expected files:

- `src/clocks.ts`
- `src/__tests__/clocks.test.ts`

Tests:

- `Date.now()` wall clock
- `performance.now()` monotonic clock
- fallback when `performance` is unavailable
- SSR-safe import

Non-goals:

- Do not expose a clock-source prop.
- Do not touch `window` during render.

Acceptance criteria:

- Hook code can depend on `readClock()`.

## Card 4: State Transitions

Objective: implement pure timer state transitions.

Expected files:

- `src/state.ts`
- `src/types.ts`
- `src/__tests__/state.test.ts`

Tests:

- idle initial state
- start
- pause
- resume
- reset
- restart
- cancel
- end
- generation increments
- elapsed excludes paused time

Non-goals:

- No React.
- No setTimeout.
- No schedules.
- No debug logging unless needed by types.

Acceptance criteria:

- State transition behavior is deterministic and documented by tests.

## Card 5: useTimer Core

Objective: implement `useTimer` lifecycle without schedules.

Expected files:

- `src/useTimer.ts`
- `src/index.ts`
- `src/__tests__/useTimer.lifecycle.test.tsx`

Tests:

- autoStart false
- autoStart true
- start/pause/resume/reset/restart/cancel
- `endWhen`
- `onEnd` once
- async `onEnd` once
- restart after ended
- cancel does not call `onEnd`
- invalid update interval

Non-goals:

- No `useTimerGroup`.
- No schedules yet.
- No docs site.

Acceptance criteria:

- Uses recursive `setTimeout`.
- Does not use `setInterval`.
- No scheduling during render.

## Card 6: Rerender and Cleanup Hardening

Objective: prove `useTimer` is safe under React behavior.

Expected files:

- `src/__tests__/useTimer.strict-mode.test.tsx`
- `src/__tests__/useTimer.cleanup.test.tsx`
- possible updates to `src/useTimer.ts`

Tests:

- rerenders do not create extra loops
- callback identity changes do not restart loop
- Strict Mode does not duplicate callbacks
- unmount clears timeout
- async stale work after unmount is ignored

Non-goals:

- Do not add public debug APIs unless assigned Card 8.

Acceptance criteria:

- Tests fail against a naive render-time `setTimeout` implementation.

## Card 7: Schedules

Objective: implement `schedules` for `useTimer`.

Expected files:

- `src/useTimer.ts`
- `src/schedules.ts` if useful
- `src/__tests__/useTimer.schedules.test.tsx`

Tests:

- cadence
- leading
- pause/resume
- overlap skip
- overlap allow
- callback controls
- stale generation guard
- invalid `everyMs`

Non-goals:

- Do not implement retries, backoff, cache, or data fetching state.

Acceptance criteria:

- Schedules are app-owned side effects only.

## Card 8: Debug Logs

Objective: implement opt-in semantic debug logs.

Expected files:

- `src/debug.ts`
- `src/useTimer.ts`
- `src/__tests__/useTimer.debug.test.tsx`

Tests:

- default no logs
- `debug: true`
- custom logger
- disabled logger object
- includeTicks behavior
- no raw timeout handles in events
- schedule skip/error events

Non-goals:

- Do not expose platform timer IDs.
- Do not log by default.

Acceptance criteria:

- Debug logs help diagnose lifecycle and scheduler behavior when enabled.

## Card 9: useTimerGroup Core

Objective: implement many keyed independent timers with one scheduler.

Expected files:

- `src/useTimerGroup.ts`
- `src/index.ts`
- `src/__tests__/useTimerGroup.lifecycle.test.tsx`
- `src/__tests__/useTimerGroup.sync.test.tsx`

Tests:

- empty group
- add/update/remove/clear
- item lifecycle controls
- existing ids preserve state
- duplicate ids throw
- one scheduler for many items
- independent `onEnd`
- cancel does not call `onEnd`

Non-goals:

- Do not implement one hook per item internally.
- Do not add modes.

Acceptance criteria:

- One group scheduler handles many items.

## Card 10: useTimerGroup Schedules and Debug

Objective: add schedules and debug logs to group items.

Expected files:

- `src/useTimerGroup.ts`
- `src/__tests__/useTimerGroup.schedules.test.tsx`
- `src/__tests__/useTimerGroup.debug.test.tsx`

Tests:

- item schedules run independently
- removed item cleanup
- stale async schedule ignored after remove
- group debug events include `timerId`
- schedule debug events include `scheduleId`

Non-goals:

- No data fetching state.

Acceptance criteria:

- Group schedules work without per-item scheduler loops.

## Card 11: Docs and Examples

Objective: update docs after API implementation.

Expected files:

- `README.md`
- `docs/API.md`
- `docs/IMPLEMENTATION.md`
- `docs/RECIPES.md` if created

Tests:

- Type-check examples if possible.

Non-goals:

- Do not change hook behavior.

Acceptance criteria:

- Docs match exported types.
- Recipes cover stopwatch, absolute countdown, pausable countdown, clock, schedules, and timer group.

## Card 12: OSS Automation

Objective: add CI, docs, and release automation.

Expected files:

- `.github/workflows/ci.yml`
- `.github/workflows/docs.yml`
- `.github/workflows/release.yml`
- `.changeset/config.json`
- docs site config files

Tests:

- Run local build/test/docs commands.

Non-goals:

- Do not change hook behavior.

Acceptance criteria:

- PR CI validates tests, types, build, docs, and README generation.
- Release workflow uses semantic versioning automation.
