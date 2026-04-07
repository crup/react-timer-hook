# Release and Documentation Automation Plan

This file turns the OSS and GTM goals into concrete automation tasks.

## Package Scripts

Recommended scripts:

```json
{
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "docs:api": "typedoc",
    "docs:site": "vitepress build docs-site",
    "docs:readme": "markdown-magic --path README.md",
    "docs:check": "pnpm docs:api && pnpm docs:site && pnpm docs:readme && git diff --exit-code README.md",
    "changeset": "changeset",
    "release": "changeset publish"
  }
}
```

These exact commands may change depending on the chosen docs stack. Keep script names stable so CI and contributor instructions stay simple.

## GitHub Actions Plan

### `.github/workflows/ci.yml`

Purpose: validate every PR and push to main.

Steps:

- checkout
- setup Node
- setup package manager
- install dependencies
- typecheck
- run tests
- build package
- build docs
- check README generation

Acceptance criteria:

- CI fails if tests fail.
- CI fails if types fail.
- CI fails if package build fails.
- CI fails if docs examples do not build.
- CI fails if generated README is stale.

### `.github/workflows/docs.yml`

Purpose: deploy docs to GitHub Pages.

Steps:

- checkout
- setup Node
- install dependencies
- build package
- generate API docs
- build docs site
- upload Pages artifact
- deploy to Pages

Acceptance criteria:

- Runs on push to `main`.
- Can run manually with `workflow_dispatch`.
- Uses official GitHub Pages actions.
- Does not publish npm package.

### `.github/workflows/release.yml`

Purpose: automate semantic releases.

Recommended with Changesets:

- checkout
- setup Node
- install dependencies
- build
- test
- run `changesets/action`
- create release PR or publish to npm

Acceptance criteria:

- Release PR updates version and changelog.
- Merging release PR publishes to npm.
- npm publish only happens after tests and build pass.
- Uses `NPM_TOKEN`.

## Changesets Plan

Tasks:

- Install `@changesets/cli`.
- Run `pnpm changeset init`.
- Configure changelog generation.
- Add contributor docs telling contributors when to add a changeset.
- Add CI check for missing changeset on public API changes if desired.

Versioning rules:

- patch for bug fixes
- minor for backwards-compatible API additions
- major for public API removals or semantic changes

## README Generation Plan

Goal: keep README accurate without making it unreadable.

Recommended structure:

```txt
docs/
  readme/
    api-summary.md
    examples.md
    badges.md
```

README contains generated blocks:

```md
<!-- AUTO-GENERATED:API-START -->
<!-- AUTO-GENERATED:API-END -->
```

Tool options:

- `markdown-magic`
- `concat-md` plus a small script
- TypeDoc Markdown output for API sections

Recommendation:

- Use `markdown-magic` for simple insertion.
- Use TypeDoc for full API docs, not for the whole README.
- Keep the README mostly hand-written.

CI check:

- run README generation
- fail if `git diff --exit-code README.md` detects stale output

## Docs Site Plan

Recommended docs stack:

- VitePress for guides
- TypeDoc for API
- `typedoc-plugin-markdown` if API pages should live inside VitePress

Docs source layout:

```txt
docs-site/
  index.md
  guide/
    getting-started.md
    concepts.md
    recipes.md
    debug.md
    timer-group.md
  api/
    generated/
```

Required pages:

- Getting started
- Concepts
- Single timer
- Timer group
- Schedules
- Debug logging
- Recipes
- API reference
- FAQ

Docs acceptance criteria:

- examples compile or are covered by type tests
- docs explain absolute deadline vs pausable duration countdowns
- docs explain no formatting/timezone support
- docs explain why `setTimeout` is used over `setInterval`

## Release Readiness Checklist

Before first public release:

- `npm pack` inspected
- package includes dist files and types
- package excludes source-only test fixtures unless intended
- README has correct install command
- docs URL works
- CI badge works
- release workflow tested with dry run or prerelease
- debug logs verified as opt-in
- no accidental console logs
- no timezone/formatting APIs included
