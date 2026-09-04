import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Client } from "colyseus.js";
import { MESSAGES } from "@ss/shared";
import { MatchRoom } from "./MatchRoom";
import type { MatchRoomState } from "./MatchState";
import { MemoryPersistence } from "../persistence/Persistence";

/**
 * Integration test: a real client joins a real room over WebSocket, sends
 * validated and invalid inputs, and the server-side sim advances (§89).
 */
const PORT = 2600 + Math.floor(Math.random() * 200);
let gameServer: Server;
let persistence: MemoryPersistence;

beforeAll(async () => {
  persistence = new MemoryPersistence();
  MatchRoom.persistence = persistence;
  const http = createServer();
  gameServer = new Server({ transport: new WebSocketTransport({ server: http }) });
  gameServer.define("match_3v3", MatchRoom);
  await gameServer.listen(PORT);
});

afterAll(async () => {
  await gameServer.gracefullyShutdown(false);
});

describe("MatchRoom (authoritative)", () => {
  it("assigns a slot, runs the sim and replicates state", async () => {
    const client = new Client(`ws://localhost:${PORT}`);
    const room = await client.joinOrCreate<MatchRoomState>("match_3v3", { playerId: "carlos_test" });

    const assigned = await new Promise<{ slot: string; team: string }>((resolve) =>
      room.onMessage("assigned", (m) => resolve(m))
    );
    expect(assigned.slot).toBe("a1");
    expect(assigned.team).toBe("A");

    // Wait until the sim leaves KICKOFF and the human holds the ball.
    await waitFor(() => room.state.match.phase === "PLAYING", 4000);
    expect(room.state.players.get("a1")?.isBot).toBe(false);
    expect(room.state.players.get("b1")?.isBot).toBe(true);

    // Send movement for ~0.5 s and check the replicated position changed.
    const before = room.state.players.get("a1")!.x;
    for (let i = 0; i < 10; i++) {
      room.send(MESSAGES.INPUT, { tick: i, move: { x: 1, z: 0 }, sprint: true, pass: false, lob: false, tackle: false });
      await sleep(50);
    }
    await waitFor(() => Math.abs(room.state.players.get("a1")!.x - before) > 0.5, 2000);

    // Invalid input (move > 1 → schema rejects) must not crash the room.
    room.send(MESSAGES.INPUT, { tick: 99, move: { x: 5, z: 0 }, sprint: false, pass: false, lob: false, tackle: false });
    await sleep(100);
    expect(room.state.match.phase).toBe("PLAYING");

    await room.leave();
    // Bot takes over the slot after leaving (disconnect recovery).
    await sleep(100);
  });
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(pred: () => boolean, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitFor timeout");
    await sleep(20);
  }
}
