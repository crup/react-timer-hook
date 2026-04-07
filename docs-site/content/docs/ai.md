---
title: AI-first usage
description: Context files and a small local MCP utility for coding agents.
---

This repository is optimized for humans and coding agents.

## Context files

- [`/llms.txt`](/react-timer-hook/llms.txt) is the short AI index.
- [`/llms-full.txt`](/react-timer-hook/llms-full.txt) includes API and recipes.

## Local context command

```sh
pnpm ai:context
```

This prints a compact JSON payload with the package name, public exports, docs URL, and current API surface.

## Local MCP utility

```sh
pnpm mcp:docs
```

The MCP utility exposes lightweight documentation resources over stdio:

- `react-timer-hook://package`
- `react-timer-hook://api`
- `react-timer-hook://recipes`

It is intentionally small and local. It is not part of the published npm package.
