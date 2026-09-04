# ADR-002: Deterministic fixed-step (60 Hz) simulation, server authoritative

**Status:** Accepted · 2026-09-04

## Decision
`MatchSimulation` advances in fixed 1/60 s steps from explicit per-player inputs and a
seeded PRNG. No `Math.random`, `Date` or platform APIs inside the sim. Humans and bots are
indistinguishable to the sim: both produce `PlayerInput`.

The server runs the sim and is the only source of truth for score, results and rewards
(§56, §136). Clients send inputs (validated with zod) and render replicated state.

## Why
- Determinism enables server validation, replays, and later client-side prediction with
  reconciliation (§57).
- Fixed step keeps input latency ≤ 16 ms and physics stable across frame rates.
- 2D-plus-height sim is cheap enough to run dozens of rooms per core.

## Consequences
- Rendering interpolates/extrapolates from sim state; never writes to it.
- All tuning numbers live in `SimConfig` (data-driven, §78).
- Tests assert determinism explicitly (`match.test.ts`).
