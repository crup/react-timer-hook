# Summary

Describe the change and why it is needed.

## Type of Change

- [ ] Bug fix
- [ ] Feature
- [ ] Documentation
- [ ] Test-only change
- [ ] Build/release automation
- [ ] Refactor with no behavior change

## Checklist

- [ ] Tests added or updated
- [ ] Docs added or updated for public behavior
- [ ] No formatting/timezone/localization behavior added to core
- [ ] No raw timeout handles exposed
- [ ] Debug logs are opt-in if touched
- [ ] `useTimerGroup` still uses one scheduler if touched
- [ ] Changeset added when release automation requires it

## Validation

Paste the commands run:

```sh
pnpm test
pnpm typecheck
pnpm build
```

## Notes

Add any follow-up work, known tradeoffs, or compatibility notes.
