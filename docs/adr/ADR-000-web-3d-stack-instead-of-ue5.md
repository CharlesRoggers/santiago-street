# ADR-000: Web 3D stack (Three.js + Node/Colyseus) instead of Unreal Engine 5

**Status:** Accepted · 2026-09-04

## Context
The master directive specified Unreal Engine 5. The project owner cannot install any
software on his machine and wants the game playable on Android. UE5 requires a
development workstation (engine, Visual Studio, Android SDK/NDK) that does not exist here,
and Claude Code cannot compile UE5 in the cloud.

## Decision
- **Client:** TypeScript + Three.js, built with Vite, shipped as a PWA (installable on
  Android without a store) and later wrapped with Capacitor for a native APK.
- **Server:** Node 22 + Colyseus (WebSocket rooms), authoritative.
- **Shared:** deterministic simulation and zod schemas used by both sides.
- **Development entirely in the cloud** (Claude Code web on a GitHub repo, previews on Vercel);
  nothing is installed on the owner's PC.

## Consequences
- Visual target changes from "PS5-era" to "realistic mobile 3D" (`docs/art/visual-target.md`).
- UE-specific directive sections (World Partition, Nanite, Lumen, GAS, Enhanced Input, Control
  Rig) are replaced by web equivalents: custom cell streaming (ADR-004), LOD/instancing, a
  code-level ability layer, our own input manager, GLB skeletal animation.
- Everything else in the directive (gameplay-first order, 3v3 first, server authority, IP policy,
  phases, quality bar) is unchanged.
- Risk: mobile GPU/thermal limits. Mitigation: quality tiers, resolution scaling, strict asset budgets.
