---
name: API design discussion
about: Discuss lifecycle semantics before proposing implementation
title: ''
labels: api-design
assignees: ''
---

# API Design Discussion

## Use Case

Describe the use case.

## Current Workaround

How would you solve this today?

## Proposed API

```tsx
// proposed usage
```

## Lifecycle Semantics

How should this interact with:

- `start`
- `pause`
- `resume`
- `reset`
- `restart`
- `cancel`
- `onEnd`
- schedules
- `useTimerGroup`

## Async Behavior

Does this involve async callbacks?

- [ ] no
- [ ] yes, with overlap allowed
- [ ] yes, with overlap skipped
- [ ] yes, unsure

## Non-Goals

What should the library not do?
