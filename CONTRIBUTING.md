# Contributing

Thanks for considering a contribution.

This project aims to stay small, deterministic, and heavily tested. Please read the requirements and API docs before proposing API changes:

- [Requirements](./REQUIREMENTS.md)
- [API Specification](./docs/API.md)
- [Implementation Plan](./docs/IMPLEMENTATION.md)
- [Task Plan](./docs/TASKS.md)

## Project Boundaries

The library owns:

- timer lifecycle state
- reliable ticking
- elapsed time calculation
- pause/resume/reset/restart/cancel behavior
- once-only end callbacks
- optional schedules
- opt-in semantic debug logs
- many keyed timer lifecycles through `useTimerGroup`

The library does not own:

- formatting
- timezone conversion
- localization
- `ampm` fields
- data fetching lifecycle
- retries or backoff
- sound/audio behavior
- app business state

## Development Workflow

1. Open or reference an issue for non-trivial changes.
2. Add or update tests first.
3. Implement the smallest change that satisfies the tests.
4. Update docs for public API changes.
5. Add a changeset once release automation is configured.
6. Run the full local validation script before opening a PR.

Expected commands after project setup:

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm docs:check
```

## API Change Rules

Prefer recipes over new API.

Before adding a new public option, ask:

- Can the user derive this from `now` or `elapsedMilliseconds`?
- Does this introduce formatting, timezone, data fetching, or business logic?
- Does this need to be supported forever?
- Can it be implemented as userland code using schedules and controls?

Do not add countdown/stopwatch/clock mode enums.

## Debug Logging

Debug logs are allowed because they help diagnose lifecycle issues, but they must stay opt-in.

Rules:

- no logs by default
- no raw timeout handles in public events
- no debug-only behavior that changes timer semantics
- tests must cover debug output

## Tests

Behavior changes require tests.

Important areas:

- React Strict Mode
- rerender behavior
- unmount cleanup
- async `onEnd`
- async schedule overlap
- generation guards
- group item add/remove cleanup

## Pull Requests

A good PR includes:

- clear problem statement
- tests
- implementation
- docs updates when public behavior changes
- notes about any intentional non-goals

Avoid unrelated refactors in behavior PRs.
