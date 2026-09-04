# Networking plan (§56–§59, §93)

Today: client offline; server room authoritative with bots (PROTOTYPE). Next steps:
1. `OnlineMatch` in client: join `match_3v3`, render from `MatchRoomState`, send inputs at 60 Hz
   (coalesce to 30 Hz on poor links).
2. Interpolation for remote players/ball (100 ms buffer).
3. Client-side prediction for the local player using the shared sim + reconciliation on server tick.
4. Auth (JWT) before any persistence beyond memory. Matchmaking via Colyseus lobby → dedicated rooms.
5. Replicate only positions, facing, stamina, ball, match state (done); never cosmetics per tick.
