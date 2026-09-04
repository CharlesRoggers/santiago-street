# ADR-006: Colyseus schema via `defineTypes` and constructor assignment

**Status:** Accepted · 2026-09-04

With `target: ES2022` (native class fields), property initializers create own properties
that shadow the accessors `@colyseus/schema` installs on the prototype, so state changes
were never encoded (bug found by the room integration test). Decorator metadata was also
inconsistent across tsx / vitest / tsup. Rule: replicated schema classes use `declare`
fields, assign defaults in the constructor, and register types with `defineTypes`.
