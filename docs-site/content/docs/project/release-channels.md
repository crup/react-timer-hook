---
title: Release channels
description: Alpha-only release policy before the first stable version.
---

The package is alpha-only until stable publishing is explicitly unlocked.

## Current channel

```sh
npm install @crup/react-timer-hook@alpha
```

## Workflow policy

- `Prerelease` publishes from `next`.
- `Prerelease` always publishes an `0.0.1-alpha.x` version.
- `Prerelease` updates the `alpha` dist-tag.
- Npm requires a `latest` dist-tag, so the workflow keeps `latest` pointing at the current alpha until stable publishing is unlocked.
- `Release` is manually gated and requires `confirm_stable_release=publish-stable`.

Consumers should use `@alpha` until the release policy changes.
