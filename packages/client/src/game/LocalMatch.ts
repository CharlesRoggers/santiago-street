import {
  BotController,
  DEFAULT_3V3_RULES,
  DEFAULT_COURT,
  MatchSimulation,
  computeMatchReward,
  type MatchRules,
  type PlayerInput,
  type Reward,
  type SimEvent,
  type TeamId
} from "@ss/shared";

/**
 * Offline match session: runs the shared simulation locally with bots.
 * STATUS: IMPLEMENTED for offline play. Online play uses the same sim on the
 * server (packages/server) — the client then becomes a renderer + input sender.
 */
export class LocalMatch {
  readonly sim: MatchSimulation;
  readonly bots: BotController;
  readonly humanTeam: TeamId = "A";
  /** Id of the player the human currently controls (switchable, §80 "Switch"). */
  controlledId: string;
  private goalsBy = new Map<string, number>();
  private assistsBy = new Map<string, number>();

  constructor(seed = (Date.now() & 0xffffff) >>> 0, rules: MatchRules = DEFAULT_3V3_RULES) {
    this.sim = new MatchSimulation({
      court: DEFAULT_COURT,
      rules,
      seed,
      players: [
        { id: "you", team: "A", isHuman: true, attributes: { speed: 0.6, control: 0.6, shot: 0.6 } },
        { id: "a2", team: "A", isHuman: false },
        { id: "a3", team: "A", isHuman: false },
        { id: "b1", team: "B", isHuman: false },
        { id: "b2", team: "B", isHuman: false },
        { id: "b3", team: "B", isHuman: false }
      ]
    });
    this.bots = new BotController(seed);
    this.controlledId = "you";
  }

  /** Advance one fixed step with the human's input. Returns the sim events. */
  step(humanInput: PlayerInput): SimEvent[] {
    for (const [id, input] of this.bots.computeInputs(this.sim.state, this.sim.dt)) {
      this.sim.setInput(id, input);
    }
    this.sim.setInput(this.controlledId, humanInput);
    const events = this.sim.step();
    for (const e of events) {
      if (e.type === "GOAL" && !e.ownGoal) {
        this.goalsBy.set(e.scorerId, (this.goalsBy.get(e.scorerId) ?? 0) + 1);
        if (e.assistId) this.assistsBy.set(e.assistId, (this.assistsBy.get(e.assistId) ?? 0) + 1);
      }
    }
    return events;
  }

  /** Hand control to the teammate closest to the ball (excluding current). */
  switchPlayer(): void {
    const { players, ball } = this.sim.state;
    const mates = players.filter((p) => p.team === this.humanTeam && p.id !== this.controlledId);
    if (mates.length === 0) return;
    const next = mates.reduce((a, b) =>
      Math.hypot(a.pos.x - ball.pos.x, a.pos.z - ball.pos.z) < Math.hypot(b.pos.x - ball.pos.x, b.pos.z - ball.pos.z) ? a : b
    );
    for (const p of players) if (p.team === this.humanTeam) p.isHuman = p.id === next.id;
    this.controlledId = next.id;
  }

  /** Reward preview for the human. Computed locally ONLY for display (§136: real rewards are server-side). */
  previewReward(): Reward {
    const m = this.sim.state.match;
    return computeMatchReward(
      { winner: m.winner, score: m.score, durationSec: m.clock, courtLevel: 1, winStreak: 0 },
      {
        team: this.humanTeam,
        goals: this.goalsBy.get("you") ?? 0,
        assists: this.assistsBy.get("you") ?? 0
      }
    );
  }
}
