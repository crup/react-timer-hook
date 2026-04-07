---
title: Contributing
description: How to contribute changes without breaking the release and timer guarantees.
---

## Local checks

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm docs:build
pnpm size
pnpm readme:check
```

## Commit style

Use Conventional Commits:

```txt
feat(timer): add lifecycle option
fix(group): preserve item state across rerenders
docs(readme): refresh alpha install instructions
ci(size): post bundle report to pull requests
```

## Timer rules

- Do not schedule work during render.
- Use recursive `setTimeout`, not `setInterval`.
- Keep timezone and formatting outside the library.
- Keep debug logs opt-in.
- Add tests for Strict Mode and async callbacks when lifecycle behavior changes.
