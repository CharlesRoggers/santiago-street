# Testing strategy (§89, §131)

- `shared`: unit tests for rules (goals, walls, match end, pass, shot, possession, stamina,
  bounds), determinism, rewards/levels/tiers, schemas. Run in <2 s.
- `server`: integration test boots a real Colyseus server, joins with `colyseus.js`, sends valid
  and invalid inputs, asserts replication. Persistence adapter unit tests.
- `content`: every JSON validates against schemas; references resolve; every key localized.
- `client`: headless Chromium smoke test (`tools/smoke/smoke.mjs`) — loads the built app, plays
  with synthetic keys, fails on any console error, saves screenshots for visual review.
- Rule: a bug fix ships with the test that would have caught it (ADR-006 came from one).
