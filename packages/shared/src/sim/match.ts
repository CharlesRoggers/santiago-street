import { SeededRandom } from "../math/random";
import type { PlayerAttributes } from "../schemas/player";
import { DEFAULT_ATTRIBUTES } from "../schemas/player";
import type { CourtDimensions } from "../schemas/world";
import type { MatchRules } from "../schemas/events";
import { DEFAULT_3V3_RULES } from "../schemas/events";
import { performPass, performShot } from "./actions";
import { resetBall, stepLooseBall } from "./ball";
import { DEFAULT_SIM_CONFIG, type SimConfig } from "./config";
import { resolvePlayerCollisions, stepMovement } from "./movement";
import { deflectOffPlayers, stepControlledBall, tryGainPossession, tryTackle } from "./possession";
import {
  EMPTY_INPUT,
  opponentOf,
  type MatchState,
  type PlayerInput,
  type SimBall,
  type SimEvent,
  type SimPlayer,
  type SimState,
  type TeamId
} from "./types";

export interface PlayerSpec {
  id: string;
  team: TeamId;
  isHuman: boolean;
  attributes?: Partial<PlayerAttributes>;
}

export interface MatchSetup {
  court: CourtDimensions;
  rules?: MatchRules;
  players: PlayerSpec[];
  seed: number;
  config?: SimConfig;
}

export const DEFAULT_COURT: CourtDimensions = {
  width: 20,
  length: 32,
  goalWidth: 3,
  goalHeight: 1.8,
  wallHeight: 3
};

/**
 * Deterministic, fixed-step match simulation (ADR-002).
 *
 * Usage:
 *   const sim = new MatchSimulation(setup);
 *   sim.setInput(playerId, input);   // every tick, for every player (humans + AI)
 *   const events = sim.step();       // advance exactly one fixed step
 *
 * The same class runs offline in the client and authoritatively on the server.
 * It never touches Math.random, Date, or any platform API.
 */
export class MatchSimulation {
  readonly cfg: SimConfig;
  readonly state: SimState;
  private readonly rng: SeededRandom;
  private inputs = new Map<string, PlayerInput>();
  private pendingEvents: SimEvent[] = [];

  constructor(setup: MatchSetup) {
    this.cfg = setup.config ?? DEFAULT_SIM_CONFIG;
    this.rng = new SeededRandom(setup.seed);
    const rules = setup.rules ?? DEFAULT_3V3_RULES;

    const players: SimPlayer[] = setup.players.map((s) => ({
      id: s.id,
      team: s.team,
      isHuman: s.isHuman,
      attributes: { ...DEFAULT_ATTRIBUTES, ...(s.attributes ?? {}) },
      pos: { x: 0, z: 0 },
      vel: { x: 0, z: 0 },
      facing: 0,
      stamina: this.cfg.stamina.max,
      sinceSprint: 10,
      stun: 0,
      kickCooldown: 0,
      loseCooldown: 0,
      tackleCooldown: 0,
      hasBall: false
    }));

    const ball: SimBall = {
      pos: { x: 0, y: this.cfg.ball.radius, z: 0 },
      vel: { x: 0, y: 0, z: 0 },
      ownerId: null,
      lastTouchId: null,
      assistCandidateId: null
    };

    const match: MatchState = {
      phase: "KICKOFF",
      clock: 0,
      phaseTimer: this.cfg.match.kickoffDelay,
      score: { A: 0, B: 0 },
      kickoffTeam: "A",
      winner: null,
      tick: 0
    };

    this.state = { court: setup.court, rules, players, ball, match };
    this.placeForKickoff("A");
  }

  get dt(): number {
    return this.cfg.fixedDt;
  }

  setInput(playerId: string, input: PlayerInput): void {
    this.inputs.set(playerId, input);
  }

  getPlayer(id: string): SimPlayer | undefined {
    return this.state.players.find((p) => p.id === id);
  }

  /** Advance one fixed step and return the events produced. */
  step(): SimEvent[] {
    const events: SimEvent[] = this.pendingEvents;
    this.pendingEvents = [];
    const { match } = this.state;
    const dt = this.cfg.fixedDt;
    match.tick++;

    switch (match.phase) {
      case "WARMUP":
      case "KICKOFF":
        match.phaseTimer -= dt;
        // Players may move during kickoff countdown but the ball is frozen.
        this.stepPlayers(dt, false, events);
        if (match.phaseTimer <= 0) {
          match.phase = "PLAYING";
          this.giveKickoffBall(match.kickoffTeam, events);
          events.push({ type: "KICKOFF", team: match.kickoffTeam });
        }
        break;

      case "PLAYING":
        match.clock += dt;
        this.stepPlayers(dt, true, events);
        this.stepBall(dt, events);
        this.checkEnd(events);
        break;

      case "GOAL":
        match.phaseTimer -= dt;
        this.stepPlayers(dt, false, events);
        if (match.phaseTimer <= 0) {
          if (this.isFinished()) {
            this.finish(events);
          } else {
            match.phase = "KICKOFF";
            match.phaseTimer = this.cfg.match.kickoffDelay;
            resetBall(this.state.ball, this.cfg);
            this.placeForKickoff(match.kickoffTeam);
          }
        }
        break;

      case "FINISHED":
        break;
    }

    this.inputs.clear();
    return events;
  }

  // ---------------------------------------------------------------- internals

  private inputFor(p: SimPlayer): PlayerInput {
    return this.inputs.get(p.id) ?? EMPTY_INPUT;
  }

  private stepPlayers(dt: number, allowActions: boolean, events: SimEvent[]): void {
    const { players, ball, court } = this.state;
    for (const p of players) stepMovement(p, this.inputFor(p), dt, this.cfg);
    resolvePlayerCollisions(players, court.width / 2, court.length / 2, this.cfg);

    if (!allowActions) return;

    const owner = ball.ownerId ? this.getPlayer(ball.ownerId) : undefined;
    if (owner) {
      const input = this.inputFor(owner);
      if (owner.stun <= 0) {
        if (input.shootPower !== undefined) {
          performShot(owner, ball, court, input.shootPower, input, this.rng, this.cfg, events);
        } else if (input.pass || input.lob) {
          performPass(owner, ball, players, input, this.rng, this.cfg, events);
        }
      }
      // Defenders may attempt tackles on the (possibly still) owner.
      if (ball.ownerId === owner.id) {
        for (const d of players) {
          if (d.team !== owner.team) tryTackle(d, owner, ball, this.inputFor(d), this.rng, this.cfg, events);
          if (ball.ownerId !== owner.id) break;
        }
      }
    }
  }

  private stepBall(dt: number, events: SimEvent[]): void {
    const { ball, court, match } = this.state;
    const owner = ball.ownerId ? this.getPlayer(ball.ownerId) : undefined;

    if (owner) {
      stepControlledBall(owner, ball, dt, this.cfg);
      // Ball dragged into a goal by a dribble counts too (walk-ins are legal in street football).
      const halfL = court.length / 2;
      const inMouth = Math.abs(ball.pos.x) < court.goalWidth / 2;
      if (inMouth && ball.pos.z > halfL) this.onGoal("A", events);
      else if (inMouth && ball.pos.z < -halfL) this.onGoal("B", events);
      return;
    }

    const result = stepLooseBall(ball, court, dt, this.cfg, events);
    if (result.goalFor) {
      this.onGoal(result.goalFor, events);
      return;
    }
    if (match.phase === "PLAYING") {
      const gained = tryGainPossession(this.state.players, ball, this.cfg, events);
      if (!gained) deflectOffPlayers(this.state.players, ball, this.cfg, events);
    }
  }

  private onGoal(team: TeamId, events: SimEvent[]): void {
    const { match, ball } = this.state;
    if (match.phase !== "PLAYING") return;
    const scorer = ball.lastTouchId ? this.getPlayer(ball.lastTouchId) : undefined;
    const ownGoal = scorer ? scorer.team !== team : false;
    const assist =
      !ownGoal && ball.assistCandidateId && this.getPlayer(ball.assistCandidateId)?.team === team
        ? ball.assistCandidateId
        : null;

    match.score[team]++;
    match.phase = "GOAL";
    match.phaseTimer = this.cfg.match.goalCelebrationTime;
    match.kickoffTeam = opponentOf(team);
    if (ball.ownerId) {
      const o = this.getPlayer(ball.ownerId);
      if (o) o.hasBall = false;
      ball.ownerId = null;
    }
    ball.vel = { x: 0, y: 0, z: 0 };
    events.push({ type: "GOAL", team, scorerId: scorer?.id ?? "", assistId: assist, ownGoal });
  }

  private isFinished(): boolean {
    const { match, rules } = this.state;
    const hitScore = match.score.A >= rules.targetScore || match.score.B >= rules.targetScore;
    const hitTime = match.clock >= rules.durationSec;
    if (rules.ruleset === "FIRST_TO") return hitScore || (rules.endOnEither && hitTime);
    if (rules.ruleset === "TIMED") return hitTime || (rules.endOnEither && hitScore);
    // Other rulesets are PLANNED (§26) — fall back to score/time.
    return hitScore || hitTime;
  }

  private checkEnd(events: SimEvent[]): void {
    if (this.state.match.phase === "PLAYING" && this.state.match.clock >= this.state.rules.durationSec) {
      this.finish(events);
    }
  }

  private finish(events: SimEvent[]): void {
    const { match, ball } = this.state;
    match.phase = "FINISHED";
    match.winner = match.score.A === match.score.B ? null : match.score.A > match.score.B ? "A" : "B";
    if (ball.ownerId) {
      const o = this.getPlayer(ball.ownerId);
      if (o) o.hasBall = false;
      ball.ownerId = null;
    }
    events.push({ type: "MATCH_END", winner: match.winner });
  }

  /** Formation: each team in its own half, staggered by index. */
  private placeForKickoff(kickoffTeam: TeamId): void {
    const { players, court } = this.state;
    const halfL = court.length / 2;
    const byTeam: Record<TeamId, SimPlayer[]> = { A: [], B: [] };
    for (const p of players) byTeam[p.team].push(p);

    (["A", "B"] as TeamId[]).forEach((team) => {
      const dir = team === "A" ? 1 : -1; // A defends -z, attacks +z
      const list = byTeam[team];
      const n = list.length;
      list.forEach((p, i) => {
        // Kickoff taker (index 0) stands near centre; others spread across own half.
        const isTaker = i === 0 && team === kickoffTeam;
        const depth = isTaker ? 1.2 : halfL * (0.3 + 0.5 * (i / Math.max(1, n - 1)));
        const spreadX = n > 1 ? ((i / (n - 1)) - 0.5) * court.width * 0.6 : 0;
        p.pos = { x: isTaker ? 0 : spreadX, z: -dir * depth };
        p.vel = { x: 0, z: 0 };
        p.facing = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        p.hasBall = false;
        p.stun = 0;
        p.kickCooldown = 0;
        p.loseCooldown = 0;
      });
    });
  }

  private giveKickoffBall(team: TeamId, events: SimEvent[]): void {
    const { ball, players } = this.state;
    resetBall(ball, this.cfg);
    const taker = players.find((p) => p.team === team);
    if (!taker) return;
    ball.ownerId = taker.id;
    ball.lastTouchId = taker.id;
    taker.hasBall = true;
    events.push({ type: "POSSESSION", playerId: taker.id });
  }
}
