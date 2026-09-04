import { createServer } from "node:http";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { MatchRoom } from "./rooms/MatchRoom";
import { MemoryPersistence } from "./persistence/Persistence";
import { log } from "./log";

/**
 * Server entry. Architecture (§58): CLIENT → AUTH (PLANNED) → MATCHMAKING
 * (Colyseus lobby, PROTOTYPE) → MATCH ROOM (authoritative) → PERSISTENCE.
 *
 * Configuration comes from the environment; secrets never live in the repo (§132).
 */
const port = Number(process.env.PORT ?? 2567);
const adapter = process.env.PERSISTENCE_ADAPTER ?? "memory";

if (adapter !== "memory") {
  // Fail loudly rather than silently falling back (§87).
  throw new Error(`PERSISTENCE_ADAPTER="${adapter}" is not implemented yet (only "memory").`);
}
MatchRoom.persistence = new MemoryPersistence();

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: true, service: "santiago-street-server", adapter }));
});

const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }) });
gameServer.define("match_3v3", MatchRoom).filterBy(["courtId"]);

gameServer.listen(port).then(() => {
  log.info("backend", `listening on :${port} (persistence=${adapter})`);
});
