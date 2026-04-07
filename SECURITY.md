# Security Policy

This package is a client-side React timer utility and should not handle secrets directly. Security reports are still taken seriously.

## Reporting a Vulnerability

Please report potential vulnerabilities privately to the maintainer email listed in `package.json`.

Do not include access tokens, private API responses, or sensitive production logs in public issues.

## Scope

In scope:

- supply chain concerns
- package publishing issues
- accidental secret exposure in repository files
- behavior that could cause unexpected network or logging side effects

Out of scope:

- application-specific polling logic written by consumers
- consumer-provided schedule callbacks
- consumer debug logs that include private data

## Debug Logging

Debug logging must remain opt-in. The library should not log by default.

If you report a bug with debug output, remove secrets, user data, private URLs, and access tokens before sharing logs.
