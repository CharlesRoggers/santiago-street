# ADR-004: World streaming by cells (planned design)

**Status:** Proposed · 2026-09-04

The city is divided into square cells (target 64 m). Each district lists its `cellIds`.
The client loads cells within radius R of the player, unloads beyond R+1, and uses
three LOD rings: full detail (current + neighbours), simplified meshes/instanced props,
and skyline impostors. Static geometry per cell ships as one GLB with a baked lightmap.
NPC simulation follows the same rings (§92). Implementation starts in Phase 5.
