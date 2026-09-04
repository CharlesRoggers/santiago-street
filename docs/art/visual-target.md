# Visual target — Santiago Street

**Owner's direction (2026-09-04):** realistic 3D in the style of modern mobile
third-person shooters — natural lighting, dense vegetation, photographic
materials, a clean minimal HUD. NOT low-poly / blocky / cel-shaded.

The current build uses `PLACEHOLDER_*` art on purpose (§155): movement, camera
and ball feel are tuned before any art investment (§3, §150).

## What "realistic on web + Android" means technically

| Layer | Approach | Status |
|---|---|---|
| Materials | PBR (`MeshStandardMaterial` / `MeshPhysicalMaterial`), 2K textures on hero assets, 1K elsewhere, KTX2/Basis compression | PLANNED |
| Lighting | Sun + sky HDRI (image-based lighting), cascaded shadow maps for near field, baked lightmaps for static neighbourhood geometry | PLANNED |
| Post-processing | ACES tone mapping (done), bloom (subtle), SSAO on high tier only, colour grading LUT per time-of-day | PARTIAL |
| Characters | Rigged humanoid GLB with skeletal animation (run/turn/receive/pass/shoot/tackle/celebrate); blend trees in code | PLANNED |
| Vegetation | Instanced meshes with wind vertex shader, billboard LODs at distance | PLANNED |
| Environment | Modular kit (walls, windows, doors, fences, poles, graffiti decals) + hand-authored hero courts | PLANNED |
| Performance | Quality tiers (LOW/MID/HIGH) auto-selected from GPU + resolution scaling; 60 fps mid-range Android, 30 fps floor | PLANNED |

Rendering hierarchy stays: PLAYER → BALL → COURT → IMMEDIATE ENVIRONMENT → CITY (§11).

## Asset sourcing rules (§4, §5)

Allowed: assets we make; CC0 libraries (e.g. Poly Haven for HDRIs/textures, Kenney,
Quaternius); purchased assets whose licence permits commercial games and
redistribution inside a compiled game; animation libraries whose licence covers game
use. Every imported asset gets a row in `docs/legal/asset-licences.md` (source, licence,
date, URL) before it lands in the repo.

Forbidden: models/textures/UI/sounds extracted from any other game; brand logos; real
club kits; Google Street View or Maps imagery as textures or references to trace.

The reference screenshots the owner shared are a *mood* reference for lighting,
density and HUD restraint. Nothing from them is reproduced.

## HUD direction

Minimal, translucent panels, thin type, corner-anchored; touch controls large and
semi-transparent, never covering the ball or the near goal. Compass/minimap only in the
open world, never during a match (§63).
