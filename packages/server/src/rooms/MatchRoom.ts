import { Room, type Client } from "colyseus";
import {
  BotController,
  ClientInputMessage,
  DEFAULT_3V3_RULES,
  DEFAULT_COURT,
  EMPTY_INPUT,
  MESSAGES,
  MatchSimulation,
  computeMatchReward,
  type MatchRules,
  type PlayerInput,
  type TeamId
} from "@ss/shared";
import { MatchRoomState, NetPlayer } from "./MatchState";
import type { Persistence } from "../persistence/Persistence";
import { log } from "../log";

/**
 * Authoritative 3v3 match room (ADR-002, §56–§58).
 *
 * STATUS: PROTOTYPE — the sim, validation and reward flow are real, but there is
 * no authentication yet (clients self-identify), no matchmaking service, and
 * no client-side prediction. Bots fill empty slots so a match always has 6.
 */
export interface MatchRoomOptions {
  courtId?: string;
  courtLevel?: number;
  rules?: MatchRules;
}

const SLOTS: Array<{ id: string; team: TeamId }> = [
  { id: "a1", team: "A" },
  { id: "b1", team: "B" },
  { id: "a2", team: "A" },
  { id: "b2", team: "B" },
  { id: "a3", team: "A" },
  { id: "b3", team: "B" }
];

export class MatchRoom extends Room<MatchRoomState> {
  override maxClients = 6;
  private sim!: MatchSimulation;
  private bots!: BotController;
  private inputs = new Map<string, PlayerInput>();
  private sessionToSlot = new Map<string, string>();
  private slotToPlayer = new Map<string, string>(); // slot → external playerId
  private goals = new Map<string, number>();
  private assists = new Map<string, number>();
  private startedAt = "";
  private courtId = "court.dev";
  private courtLevel = 1;
  private persisted = false;

  static persistence: Persistence; // injected in index.ts

  override onCreate(options: MatchRoomOptions): void {
    const seed = (Math.random() * 0xffffffff) >>> 0; // seed chosen ONCE by the server; sim itself is deterministic
    this.courtId = options.courtId ?? this.courtId;
    this.courtLevel = options.courtLevel ?? 1;
    const rules = options.rules ?? DEFAULT_3V3_RULES;

    this.sim = new MatchSimulation({
      court: DEFAULT_COURT,
      rules,
      seed,
      players: SLOTS.map((s) => ({ id: s.id, team: s.team, isHuman: false }))
    });
    this.bots = new BotController(seed);

    this.setState(new MatchRoomState());
    this.state.seed = seed;
    this.state.courtWidth = DEFAULT_COURT.width;
    this.state.courtLength = DEFAULT_COURT.length;
    for (const s of SLOTS) {
      const np = new NetPlayer();
      np.id = s.id;
      np.team = s.team;
      np.isBot = true;
      this.state.players.set(s.id, np);
    }

    this.onMessage(MESSAGES.INPUT, (client, raw) => this.onInput(client, raw));

    // Fixed 60 Hz sim; state patches go out at 20 Hz (Colyseus default patch rate).
    this.setSimulationInterval(() => this.tick(), 1000 * this.sim.dt);
    this.setPatchRate(50);
    this.startedAt = new Date().toISOString();
    log.info("room", `MatchRoom ${this.roomId} created seed=${seed} court=${this.courtId}`);
  }

  override onJoin(client: Client, options: { playerId?: string; displayName?: string }): void {
    // Fill teams alternately so a solo player gets bots on both sides.
    const free = SLOTS.find((s) => ![...this.sessionToSlot.values()].includes(s.id));
    if (!free) {
      client.leave(4000, "room_full");
      return;
    }
    const playerId = sanitizeId(options.playerId) ?? `guest-${client.sessionId}`;
    this.sessionToSlot.set(client.sessionId, free.id);
    this.slotToPlayer.set(free.id, playerId);
    const simP = this.sim.getPlayer(free.id);
    if (simP) simP.isHuman = true;
    const np = this.state.players.get(free.id);
    if (np) {
      np.isBot = false;
      np.sessionId = client.sessionId;
    }
    client.send("assigned", { slot: free.id, team: free.team });
    log.info("room", `${playerId} joined ${this.roomId} as ${free.id}`);
  }

  override onLeave(client: Client): void {
    const slot = this.sessionToSlot.get(client.sessionId);
    if (!slot) return;
    this.sessionToSlot.delete(client.sessionId);
    this.slotToPlayer.delete(slot);
    const simP = this.sim.getPlayer(slot);
    if (simP) simP.isHuman = false; // bot takes over — the match continues (§57 disconnect recovery)
    const np = this.state.players.get(slot);
    if (np) {
      np.isBot = true;
      np.sessionId = "";
    }
    this.inputs.delete(slot);
  }

  private onInput(client: Client, raw: unknown): void {
    const slot = this.sessionToSlot.get(client.sessionId);
    if (!slot) return;
    const parsed = ClientInputMessage.safeParse(raw);
    if (!parsed.success) {
      log.warn("net", `rejected input from ${client.sessionId}: ${parsed.error.issues[0]?.message}`);
      return;
    }
    const m = parsed.data;
    // Clamp move magnitude server-side: a modified client cannot move faster (§61).
    const len = Math.hypot(m.move.x, m.move.z);
    const move = len > 1 ? { x: m.move.x / len, z: m.move.z / len } : m.move;
    const input: PlayerInput = { move, sprint: m.sprint, pass: m.pass, lob: m.lob, tackle: m.tackle };
    if (m.shootPower !== undefined) input.shootPower = m.shootPower;
    if (m.passTargetId) input.passTargetId = m.passTargetId;
    this.inputs.set(slot, input);
  }

  private tick(): void {
    if (this.sim.state.match.phase === "FINISHED") return;

    for (const [id, input] of this.bots.computeInputs(this.sim.state, this.sim.dt)) this.sim.setInput(id, input);
    for (const [slot, input] of this.inputs) this.sim.setInput(slot, input);
    // Edge actions are consumed once; keep movement/sprint held until the next message.
    for (const [slot, input] of this.inputs) {
      const held: PlayerInput = { ...EMPTY_INPUT, move: input.move, sprint: input.sprint };
      this.inputs.set(slot, held);
    }

    const events = this.sim.step();
    for (const e of events) {
      if (e.type === "GOAL" && !e.ownGoal) {
        this.goals.set(e.scorerId, (this.goals.get(e.scorerId) ?? 0) + 1);
        if (e.assistId) this.assists.set(e.assistId, (this.assists.get(e.assistId) ?? 0) + 1);
      }
      if (e.type === "MATCH_END") void this.finishMatch();
    }
    if (events.length) this.broadcast(MESSAGES.MATCH_EVENTS, events);

    this.syncState();
  }

  private syncState(): void {
    const s = this.sim.state;
    for (const p of s.players) {
      const np = this.state.players.get(p.id);
      if (!np) continue;
      np.x = p.pos.x;
      np.z = p.pos.z;
      np.facing = p.facing;
      np.stamina = Math.round(p.stamina);
      np.hasBall = p.hasBall;
      np.stunned = p.stun > 0;
    }
    this.state.ball.x = s.ball.pos.x;
    this.state.ball.y = s.ball.pos.y;
    this.state.ball.z = s.ball.pos.z;
    this.state.ball.vx = s.ball.vel.x;
    this.state.ball.vz = s.ball.vel.z;
    this.state.ball.ownerId = s.ball.ownerId ?? "";
    this.state.match.phase = s.match.phase;
    this.state.match.clock = s.match.clock;
    this.state.match.scoreA = s.match.score.A;
    this.state.match.scoreB = s.match.score.B;
    this.state.match.winner = s.match.winner ?? "";
    this.state.match.tick = s.match.tick;
  }

  /**
   * Server validates the match it ran itself, computes rewards and persists
   * them (§136–§137). Clients only receive the result.
   */
  private async finishMatch(): Promise<void> {
    if (this.persisted) return;
    this.persisted = true;
    const m = this.sim.state.match;
    const summary = {
      winner: m.winner,
      score: m.score,
      durationSec: m.clock,
      courtLevel: this.courtLevel,
      winStreak: 0
    };
    const rewards: Record<string, { xp: number; money: number; reputation: number }> = {};
    const participants = [];

    for (const slot of SLOTS) {
      const playerId = this.slotToPlayer.get(slot.id);
      const goals = this.goals.get(slot.id) ?? 0;
      const assists = this.assists.get(slot.id) ?? 0;
      participants.push({ playerId: playerId ?? `bot-${slot.id}`, team: slot.team, goals, assists, isBot: !playerId });
      if (!playerId) continue;
      const reward = computeMatchReward(summary, { team: slot.team, goals, assists });
      const outcome = m.winner === null ? "draw" : m.winner === slot.team ? "win" : "loss";
      await MatchRoom.persistence.applyReward(playerId, reward, outcome, goals, assists);
      rewards[slot.id] = { xp: reward.xp, money: reward.money, reputation: reward.reputation };
    }

    await MatchRoom.persistence.recordMatch({
      matchId: this.roomId,
      courtId: this.courtId,
      startedAt: this.startedAt,
      endedAt: new Date().toISOString(),
      durationSec: m.clock,
      score: { ...m.score },
      winner: m.winner,
      participants,
      seed: this.state.seed
    });

    this.broadcast(MESSAGES.MATCH_RESULT, { winner: m.winner, score: m.score, durationSec: m.clock, rewards });
    log.info("room", `match ${this.roomId} finished ${m.score.A}-${m.score.B}`);
    this.disconnect().catch(() => undefined);
  }
}

function sanitizeId(id: unknown): string | null {
  if (typeof id !== "string") return null;
  return /^[A-Za-z0-9_-]{3,64}$/.test(id) ? id : null;
}
