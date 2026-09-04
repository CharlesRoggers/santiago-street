# Architecture overview

```
 ┌──────────── client (browser / Android PWA) ────────────┐
 │ InputManager → PlayerInput ─┐                           │
 │ TouchControls / Gamepad     │   LocalMatch (offline)    │
 │                             ├─► MatchSimulation ◄─ Bots │
 │ FollowCamera, *View ◄───────┘   (from @ss/shared)       │
 │ Hud (i18n)                                              │
 └────────────── (online mode PLANNED: colyseus.js) ───────┘
                                  ▲ ClientInputMessage (zod)   ▼ replicated MatchRoomState + events
 ┌──────────────── server (Node + Colyseus) ───────────────┐
 │ MatchRoom: sim @60 Hz, bots fill slots, validation,     │
 │            rewards on MATCH_END → Persistence           │
 │ Persistence: Memory (dev) │ Postgres (PLANNED)          │
 │ log: structured categories                              │
 └─────────────────────────────────────────────────────────┘
 shared: math · schemas (player, world, crew, events, cosmetics) · sim · ai · progression · net protocol
 content: cities/districts/courts/metro JSON + locales, validated by tests
```

Match flow (§121): COURT → KICKOFF (1.2 s) → PLAYING → GOAL (2.5 s) → KICKOFF … → FINISHED →
RESULT → REWARD (server) → back to world.
