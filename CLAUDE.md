# SANTIAGO STREET — Claude Code operating manual

Open-world multiplayer street football. Fictionalized Santiago. 3v3 first.
This file is the condensed, binding version of `docs/production/master-directive.md`.
Read it fully before touching code. When in doubt, the directive wins.

## 0. What this project is (and is not)

- Commercial-quality game foundation, built incrementally. Not a demo, not a clone.
- **Stack (ADR-000):** TypeScript monorepo. Client = Three.js (browser + Android PWA).
  Server = Node + Colyseus (authoritative). Shared = deterministic simulation + zod schemas.
  Unreal Engine 5 was the original target and was replaced because the owner cannot
  install software on his machine; the product vision is unchanged.
- **Non-negotiables (§158):** football must be fun; controls responsive; ball must feel
  good; world alive; progression matters; crews/courts matter; multiplayer secure;
  performance monitored; all content original; third-party data licence-compliant; do
  not build everything at once; never hide technical debt; never pretend a mock is
  production; always keep the project buildable.

## 1. Repository map

```
packages/shared    @ss/shared   — sim (fixed 60 Hz, deterministic), AI, schemas, rewards, net protocol
packages/client    @ss/client   — Three.js renderer, input (keyboard/gamepad/touch), HUD, PWA
packages/server    @ss/server   — Colyseus MatchRoom (authoritative), persistence adapter, logs
packages/content   @ss/content  — cities/districts/courts/metro/cosmetics as JSON + locale tables
tools/smoke        headless-browser smoke test (screenshots + console errors)
docs/              adr/, architecture/, gameplay/, world/, networking/, production/, legal/, testing/
```

Rules of dependency: `shared` imports nothing platform-specific (no DOM, no Node, no three, no
colyseus). `client` and `server` import `shared`. Nothing imports `client` or `server`.

## 2. Commands

```
pnpm install
pnpm check                 # typecheck + tests + build for every package (run before every commit)
pnpm dev                   # client at http://localhost:5173
pnpm dev:server            # server at ws://localhost:2567 (health: http://localhost:2567/)
CHROMIUM_PATH=<chrome> node tools/smoke/smoke.mjs   # after `pnpm build`; writes tools/smoke/*.png
```

Node ≥ 22, pnpm 10. No global installs are required beyond pnpm.

## 3. Status ledger — keep this honest (§153)

| System | Status | Notes |
|---|---|---|
| Deterministic match sim (movement, stamina, ball, possession, pass, lob, shot, tackle, deflection, goals, rules) | IMPLEMENTED | `shared/src/sim`, 12 tests |
| 3v3 bot AI | PROTOTYPE | Utility AI with mistakes. Known: slight team-B win bias over 16 seeds; straight sprint from kickoff too effective |
| Rewards / XP / tiers | IMPLEMENTED (rules) | Pure functions; server applies them |
| Client offline match (render, camera, input, HUD, touch, PWA) | IMPLEMENTED | Placeholder art. Runs in browser + installable on Android |
| Authoritative server room | PROTOTYPE | Real sim + validation + memory persistence; **no auth, no matchmaking service, no prediction** |
| Client ↔ server online play | PLANNED | Server exists; client has no network mode yet (Phase 7) |
| Persistence (Postgres) | PLANNED | Interface exists, only `MemoryPersistence` |
| World / neighbourhood / NPCs / metro / streaming | PLANNED | Content schemas + first district data exist |
| Crews, court ownership, events, tournaments | PLANNED | Schemas exist |
| Voice/text chat, moderation | PLANNED | |
| Real character models / animation | PLANNED | Procedural placeholder figure |

Update this table in the same commit as the code that changes it.

## 4. Operating procedure for every significant task (§151)

1. **INSPECT** — read the relevant files and the ADRs. Run `pnpm check`.
2. **PLAN** — affected systems, dependencies, risks. Write it in the PR/commit body.
3. **IMPLEMENT** — smallest coherent change. Keep the sim deterministic (no `Math.random`,
   `Date`, or platform APIs inside `shared/src/sim`; use `SeededRandom`).
4. **TEST** — unit tests in `shared`/`server`; smoke test for the client. Add a test for
   every rule you touch (score, goals, rewards, XP, ownership, disconnects).
5. **DEBUG** — fix regressions before adding anything else.
6. **DOCUMENT** — ADR for architectural decisions (`docs/adr/ADR-NNN-*.md`), update the
   status ledger above and `docs/production/placeholders.md`.
7. **REPORT** — what changed, what works, what remains, next step. Then continue.

Autonomy (§152): do not ask for permission for choices clearly implied by the directive.
Stop and ask only for: product-defining ambiguity, credentials, paid services, legal
permission, unavoidable destructive actions, or radically different consequences.

## 5. Development order (§156) — where we are

1 project audit ✅ · 2 player movement ✅ · 3 camera ✅ (tune) · 4 animation foundation ▶
(procedural placeholder) · 5 ball ✅ · 6 possession ✅ · 7 passing ✅ · 8 shooting ✅ ·
9 dribbling ▶ (basic carry; skill moves PLANNED) · 10 defense ✅ (tackle, blocking) ·
11 goal ✅ · 12 match state ✅ · 13 3v3 AI ▶ (prototype) · 14 court ✅ (placeholder) ·
**15 vertical slice ◀ NEXT** · 16 progression · 17 economy · 18 world · 19 crew ·
20 court ownership · 21 multiplayer · 22 voice · 23 scale · 24 polish

**Immediate next tasks, in order:**
1. Playtest & tune the core loop (§150 quality bar) — camera framing so teammates are visible,
   kickoff defence, shot conversion, bot symmetry. Do not add content until it is fun.
2. Skill moves: a small set (body feint, stepover, cut) as sim actions with stamina cost.
3. Client online mode: `OnlineMatch` using `colyseus.js`, render from replicated state,
   send `ClientInputMessage`; then client-side prediction for the local player.
4. Vertical slice world shell: walkable neighbourhood block around the court, enter court
   → match → result → back to world.

## 6. Coding standards (§123, §78, §86, §87)

- TypeScript strict. No `any` in `shared`. `exactOptionalPropertyTypes` is on — build
  optional fields conditionally.
- Data-driven: tuning numbers live in `shared/src/sim/config.ts` or content JSON, never inline.
- No hardcoded user-facing strings: use `t("key")` (client) and `nameKey` fields (content).
  Spanish first; keep `es.json` and `en.json` in sync.
- No silent failures: validate input (zod), throw on unsupported config, log with categories.
- Naming: `PascalCase` classes, `camelCase` functions, `SCREAMING_CASE` constants,
  content ids as `kind.slug` (`court.plaza-del-cerro`), locale keys `kind.slug.field`.
- Commits: conventional (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`).

## 7. Security & IP rules (never bend these)

- Client is never trusted for money, XP, inventory, results, ranking, ownership, score.
  Rewards are computed **only** in `MatchRoom.finishMatch` from the server's own sim.
- No secrets in the repo. `.env` is git-ignored; document new vars in `.env.example`.
- No real clubs, players, brands, metro branding, logos, music, ripped assets, Street View
  or Google imagery. Fictional brands live in `shared/src/schemas/cosmetics.ts` and must be
  cleared before commercial use. Geo data only from sources listed in `docs/legal/geodata.md`.
- User-generated images (crew logos) are not allowed; use curated libraries.

## 8. Placeholders

Every placeholder asset/system is listed in `docs/production/placeholders.md`. If you add
one, prefix it `PLACEHOLDER_` in code comments and add it to the list in the same commit.
