# ADR-001: pnpm monorepo with a platform-free `shared` package

**Status:** Accepted · 2026-09-04

## Decision
Four packages: `shared`, `client`, `server`, `content`. `shared` may not import DOM, Node,
three or colyseus. `client` and `server` depend on `shared`. `content` is JSON validated by
`shared` schemas.

## Why
The same football simulation must run in the browser (offline / prediction) and on the
server (authority). One code path, one set of tests, no drift between "what the player
sees" and "what the server rules".

## Consequences
Anything platform-specific (rendering, sockets, files) lives outside `shared`. Path aliases
(`@ss/shared`) are configured in each package's tsconfig and bundler.
