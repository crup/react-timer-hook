# Branching, Prereleases, and Commits

This project uses short-lived feature branches, a prerelease integration branch, npm dist-tags, Changesets, and Conventional Commits.

## Branches

Use these branch names:

- `main`: stable branch. Publishes stable npm releases with the `latest` dist-tag.
- `next`: prerelease integration branch. Publishes alpha, beta, and release-candidate builds with prerelease npm dist-tags.
- `feature/*`: feature work.
- `fix/*`: bug fixes.
- `docs/*`: documentation-only work.
- `chore/*`: maintenance work.

Do not use a long-lived `develop` branch. `next` is enough for prerelease integration.

## First Branch

For the current v1 implementation work, use:

```sh
git switch -c feature/timer-core-v1
```

Merge that branch into `next` first for alpha testing. Merge into `main` only when the package is ready for stable release.

## Alpha Before `0.0.1`

Before the first stable `0.0.1`, publish alpha builds from `next`.

Use:

- branch: `next`
- prerelease id: `alpha`
- npm dist-tag: `alpha`

Example versions:

```txt
0.0.1-alpha.<github-run-number>
```

Install test builds with:

```sh
npm install @crup/react-timer-hook@alpha
pnpm add @crup/react-timer-hook@alpha
```

## Local Changesets Prerelease Flow

This is the Changesets flow for versioned prerelease branches. For early temporary alpha deployments, prefer the manual GitHub Actions flow below.

Enter alpha mode on `next`:

```sh
git switch next
pnpm changeset pre enter alpha
```

Add a changeset for public changes:

```sh
pnpm changeset
```

Version and publish an alpha:

```sh
pnpm changeset version
pnpm changeset publish --tag alpha
```

Move from alpha to beta:

```sh
pnpm changeset pre exit
pnpm changeset pre enter beta
pnpm changeset version
pnpm changeset publish --tag beta
```

Move from beta to release candidate:

```sh
pnpm changeset pre exit
pnpm changeset pre enter rc
pnpm changeset version
pnpm changeset publish --tag rc
```

Publish stable from `main`:

```sh
pnpm changeset pre exit
pnpm changeset version
pnpm changeset publish
```

Stable publish uses the default npm `latest` dist-tag.

## GitHub Actions Release Flow

Stable releases:

- Branch: `main`
- Workflow: `.github/workflows/release.yml`
- npm dist-tag: `latest`
- Trigger: push to `main`

Prereleases:

- Branch: `next`
- Workflow: `.github/workflows/prerelease.yml`
- npm dist-tag: manual input, usually `alpha`, then `beta`, then `rc`
- version shape: `<version_base>-<tag>.<github-run-number>`, for example `0.0.1-alpha.42`
- Trigger: manual `workflow_dispatch`

The prerelease workflow should stay manual until the release process is proven. Do not publish every push to `next`.

Required GitHub repository settings:

- Enable GitHub Actions.
- Set Pages source to GitHub Actions.
- Protect `main` after the first PR is merged.
- Add `NPM_TOKEN` as a repository secret.
- Allow GitHub Actions to create pull requests if using Changesets release PR automation.

## Conventional Commits

Commit messages must follow:

```txt
<type>(<scope>): <summary>
```

Examples:

```txt
feat(timer): implement lifecycle controls
fix(group): preserve item state across rerenders
test(timer): cover strict mode cleanup
docs(release): document alpha prerelease flow
chore(deps): update vitest
ci(release): add alpha publish workflow
```

Allowed types come from `@commitlint/config-conventional`, including:

- `feat`
- `fix`
- `docs`
- `test`
- `refactor`
- `chore`
- `ci`
- `build`
- `perf`

Allowed scopes are configured in `commitlint.config.cjs`:

- `api`
- `build`
- `ci`
- `debug`
- `deps`
- `docs`
- `group`
- `release`
- `schedules`
- `state`
- `timer`
- `types`

Breaking changes:

```txt
feat(timer)!: rename stop to cancel
```

or:

```txt
feat(timer): rename stop to cancel

BREAKING CHANGE: stop() was removed. Use cancel(reason?) instead.
```

## Commits vs Versions

Conventional Commits keep history readable and enforce consistency.

Changesets decide package versions and changelog entries.

Do not rely only on commit messages to publish versions. Public behavior changes should include a changeset.
