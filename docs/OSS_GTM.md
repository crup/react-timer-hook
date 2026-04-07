# OSS and GTM Plan

This document covers open-source readiness, project launch, documentation, CI/CD, release automation, and contributor workflows.

## Positioning

Position the package as:

> A deterministic React timer lifecycle library for countdowns, stopwatches, clocks, schedules, and many independent timers.

Do not position it as:

- a date formatting library
- a timezone library
- a polling/data fetching library
- an audio/sound timer library
- a clone of the old `react-timer-hook` API

## Differentiators

- Explicit lifecycle controls: `start`, `pause`, `resume`, `reset`, `restart`, `cancel`.
- Raw deterministic data: `now`, `elapsedMilliseconds`, `status`, `tick`.
- No formatting or timezone opinions.
- One primitive for countdown, stopwatch, and clock derivations.
- `useTimerGroup` for many keyed independent timers with one scheduler.
- Async-safe `onEnd` and schedules.
- Strict Mode and unmount cleanup tests.
- Opt-in debug logs for lifecycle diagnosis.

## Documentation Site

Use GitHub Pages for docs.

Recommended stack:

- VitePress for hand-written guide pages.
- TypeDoc for API reference generated from TypeScript types and TSDoc comments.
- `typedoc-plugin-markdown` if Markdown output is preferred inside VitePress.

Docs sections:

- Getting started
- Core concepts
- `useTimer`
- `useTimerGroup`
- Recipes
- Debug logging
- Testing timers in apps
- API reference
- Migration notes from previous timer libraries
- FAQ

GitHub Pages deployment:

- Build docs on push to `main`.
- Deploy generated static docs to GitHub Pages.
- Do not deploy docs on every PR, but do build docs in CI to catch broken examples.

## README Generation

Automated README generation is useful, but the README should remain human-readable and reviewable.

Recommended approach:

- Keep source sections in `docs/readme/` or `docs/README.template.md`.
- Use an OSS tool such as `markdown-magic` or a small documented script to inject:
  - API summary
  - package badges
  - selected examples
  - generated table of contents
- Run `pnpm docs:readme` in CI and fail if README is stale.

Important:

- Do not make README generation depend on network access.
- Generated README output should be deterministic.
- Generated blocks should be clearly marked.

Example generated block markers:

```md
<!-- AUTO-GENERATED:API-START -->
<!-- AUTO-GENERATED:API-END -->
```

## GitHub Actions

Add workflows after implementation exists.

### CI Workflow

Trigger:

- pull requests
- push to `main`

Jobs:

- install dependencies
- typecheck
- test
- build
- docs build
- README generation check

Recommended matrix:

- latest LTS Node
- current Node

For v1, avoid a large matrix until the project has users.

### Docs Workflow

Trigger:

- push to `main`
- manual dispatch

Jobs:

- install dependencies
- build package
- build docs
- deploy to GitHub Pages

Required setup:

- GitHub Pages source: GitHub Actions
- permissions:
  - `contents: read`
  - `pages: write`
  - `id-token: write`

### Release Workflow

Recommended release tool: Changesets.

Why Changesets:

- explicit semver decisions
- good for libraries
- generates changelog entries
- creates release PRs
- publishes after merge

Workflow:

- contributors add a changeset for public changes
- CI validates changesets where needed
- Changesets GitHub Action opens or updates a release PR
- merging the release PR publishes to npm
- GitHub release notes are created from changelog

Required secrets:

- `NPM_TOKEN`

Optional:

- npm provenance if supported by the package manager and registry setup

## Semantic Versioning

Use semver strictly.

Patch:

- bug fixes
- documentation fixes
- internal test/build changes
- debug log detail additions that do not change public types

Minor:

- new public options
- new public debug event types
- new pure utilities
- new non-breaking hook return fields
- new recipes or docs site sections

Major:

- removing public API
- renaming public fields
- changing lifecycle semantics
- changing default schedule overlap behavior
- changing debug event shape in a breaking way
- removing CJS if previously supported

Pre-1.0 note:

Even before `1.0.0`, behave as if semver matters. OSS users lose trust when `0.x` is used as an excuse for churn.

## Issue Templates

Use templates for:

- bug report
- feature request
- API design discussion

Bug reports should ask for:

- React version
- package version
- environment
- fake timer or real timer usage
- Strict Mode status
- expected behavior
- actual behavior
- minimal reproduction
- whether debug logs are enabled

Feature requests should ask:

- problem statement
- why app code cannot solve it
- proposed API
- alternatives considered
- whether it adds formatting, timezone, data fetching, or business logic

API design discussions should ask:

- use case
- code sample
- lifecycle semantics
- async behavior
- interaction with `useTimerGroup`

## Contribution Guide

Contributors should be told:

- tests are required for behavior changes
- no formatting/timezone features in core
- no public timer handles
- no new hook unless the use case cannot be solved by `useTimer` or `useTimerGroup`
- keep debug logging opt-in
- update docs for public API changes
- add a changeset for public changes once Changesets is configured

## Launch Checklist

Pre-release:

- implementation tests pass
- CI passes
- docs site builds
- README generated and checked
- package exports verified
- package tarball inspected with `npm pack`
- examples compile
- issue templates and PR template added
- license added
- package metadata updated

Launch:

- publish first prerelease if desired
- announce with examples focused on correctness
- request feedback on API semantics
- track issues around Strict Mode, schedules, and group timers

Post-launch:

- resist adding formatting or timezone features
- prefer recipes over API expansion
- add `useTimerGroup` performance tests if users report large lists
- refine debug logs based on real debugging needs
