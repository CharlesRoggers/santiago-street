# ADR-005: Persistence behind an interface; Postgres planned

**Status:** Accepted · 2026-09-04

`Persistence` (server) is the only way gameplay code touches player data. `MemoryPersistence`
exists for development and tests. The production adapter will be Postgres (Supabase is the
likely host given the owner's familiarity), with static configuration (courts, cosmetics)
kept separate from player data (§60). Reward application must be atomic per player.
