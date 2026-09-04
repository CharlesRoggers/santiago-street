import { angleOf, distance, length, normalize, scale, sub, add, clamp } from "../math/vec2";
import type { Vec2 } from "../math/vec2";
import { SeededRandom } from "../math/random";
import { DEFAULT_SIM_CONFIG, type SimConfig } from "./config";
import { attackDirection, type PlayerInput, type SimPlayer, type SimState, type TeamId } from "./types";

/**
 * STATUS: PROTOTYPE (§153).
 *
 * Utility-style football AI (§46) that produces ordinary PlayerInput — the sim
 * cannot tell a bot from a human. Deliberately imperfect: reaction delay,
 * aim noise and a per-bot "hesitation" so it makes human-like mistakes.
 *
 * Side symmetry: decisions are taken in court space and random draws are consumed
 * in roster order, so a match mirrored in z plays out as an exact reflection
 * (enforced by balance.test.ts). Keep it that way when adding behaviours.
 */
export interface BotPersonality {
  /** 0..1 — how aggressively the bot presses/tackles. */
  aggression: number;
  /** 0..1 — probability per decision to keep dribbling instead of passing. */
  selfishness: number;
  /** Seconds between decisions (reaction time). */
  reaction: number;
}

export const DEFAULT_PERSONALITY: BotPersonality = { aggression: 0.5, selfishness: 0.4, reaction: 0.18 };

/** Minimum perpendicular clearance (m) for a bot to consider a lane usable. */
const PASS_LANE_CLEARANCE = 1.0;
const SHOT_LANE_CLEARANCE = 0.8;

interface BotMemory {
  nextDecision: number;
  input: PlayerInput;
  /** Seconds spent charging the current shot, or null when not shooting. */
  shotCharge: number | null;
  /** Power (0..1) chosen for the current shot. */
  shotPower: number;
}

export class BotController {
  private memory = new Map<string, BotMemory>();
  private rng: SeededRandom;

  constructor(
    seed: number,
    private personality: BotPersonality = DEFAULT_PERSONALITY,
    private cfg: SimConfig = DEFAULT_SIM_CONFIG
  ) {
    this.rng = new SeededRandom(seed ^ 0x9e3779b9);
  }

  /** Compute inputs for every non-human player; call once per sim tick before sim.step(). */
  computeInputs(state: SimState, dt: number): Map<string, PlayerInput> {
    const out = new Map<string, PlayerInput>();
    for (const p of state.players) {
      if (p.isHuman) continue;
      out.set(p.id, this.inputFor(p, state, dt));
    }
    return out;
  }

  private inputFor(bot: SimPlayer, state: SimState, dt: number): PlayerInput {
    let mem = this.memory.get(bot.id);
    if (!mem) {
      mem = { nextDecision: 0, input: idle(), shotCharge: null, shotPower: 0 };
      this.memory.set(bot.id, mem);
    }
    mem.nextDecision -= dt;

    // Edge actions must only fire once: clear them every tick.
    mem.input = { ...mem.input, pass: false, lob: false, tackle: false };
    delete mem.input.shootPower;

    // Shot charging is continuous and takes as long as it would for a human (§21).
    if (mem.shotCharge !== null) {
      mem.shotCharge += dt;
      if (mem.shotCharge >= mem.shotPower * this.cfg.shot.chargeTime) {
        const power = mem.shotPower;
        mem.shotCharge = null;
        return { ...mem.input, shootPower: power };
      }
      return mem.input;
    }

    if (mem.nextDecision > 0 && state.match.phase === "PLAYING") return mem.input;
    mem.nextDecision = this.personality.reaction * this.rng.range(0.7, 1.4);

    if (state.match.phase !== "PLAYING") {
      mem.input = idle();
      return mem.input;
    }

    const ball2 = { x: state.ball.pos.x, z: state.ball.pos.z };
    const owner = state.ball.ownerId ? state.players.find((p) => p.id === state.ball.ownerId) : undefined;

    if (owner?.id === bot.id) {
      mem.input = this.attackWithBall(bot, state, mem);
    } else if (owner && owner.team === bot.team) {
      mem.input = this.support(bot, owner, state);
    } else if (owner) {
      mem.input = this.defend(bot, owner, state);
    } else {
      mem.input = this.chaseLoose(bot, ball2, state);
    }
    return mem.input;
  }

  // ------------------------------------------------------------- behaviours

  private attackWithBall(bot: SimPlayer, state: SimState, mem: BotMemory): PlayerInput {
    const dir = attackDirection(bot.team);
    const goal: Vec2 = { x: 0, z: (state.court.length / 2) * dir };
    const toGoal = sub(goal, bot.pos);
    const distGoal = length(toGoal);
    const nearestOpp = this.nearestOpponent(bot, state);
    const pressure = nearestOpp ? distance(nearestOpp.pos, bot.pos) : 99;

    // Shoot when in range and a lane to a post is open — sometimes even when it is not.
    const shootRange = state.court.length * 0.3;
    if (distGoal < shootRange) {
      const side = this.openGoalSide(bot.pos, state, bot.team);
      if (side !== null || this.rng.chance(0.08)) {
        // Power by distance: blast from close, place from range — full power from far clears the bar.
        mem.shotPower = clamp(0.9 - (distGoal / shootRange) * 0.4, 0.5, 0.9);
        mem.shotCharge = 0;
        // performShot reads placement as shooter-relative stick x; convert the court-space side.
        const aim = (side ?? 0) * dir * 0.8;
        return { move: { x: aim, z: 0 }, sprint: false, pass: false, lob: false, tackle: false };
      }
    }

    // Under pressure: pass (unless selfish) to the most advanced open teammate.
    if (pressure < 2.2 && !this.rng.chance(this.personality.selfishness)) {
      const mate = this.bestPassOption(bot, state);
      if (mate) {
        const d = normalize(sub(mate.pos, bot.pos));
        return { move: d, sprint: false, pass: true, lob: false, tackle: false, passTargetId: mate.id };
      }
    }

    // Dribble towards goal, veering away from the nearest defender.
    let move = normalize(toGoal);
    if (nearestOpp && pressure < 3.5) {
      const away = normalize(sub(bot.pos, nearestOpp.pos));
      move = normalize(add(move, scale(away, 0.9)));
    }
    return { move, sprint: pressure > 3 && bot.stamina > 30, pass: false, lob: false, tackle: false };
  }

  private support(bot: SimPlayer, owner: SimPlayer, state: SimState): PlayerInput {
    const dir = attackDirection(bot.team);
    // Take a lane ahead of the ball carrier on the opposite side of the court.
    const side = bot.pos.x >= owner.pos.x ? 1 : -1;
    const target: Vec2 = {
      x: clamp(owner.pos.x + side * state.court.width * 0.3, -state.court.width / 2 + 1, state.court.width / 2 - 1),
      z: clamp(owner.pos.z + dir * 6, -state.court.length / 2 + 2, state.court.length / 2 - 2)
    };
    return this.moveTo(bot, target, false);
  }

  private defend(bot: SimPlayer, owner: SimPlayer, state: SimState): PlayerInput {
    const myGoal: Vec2 = { x: 0, z: -(state.court.length / 2) * attackDirection(bot.team) };
    const teammates = state.players.filter((p) => p.team === bot.team);
    const closest = teammates.reduce((a, b) => (distance(a.pos, owner.pos) < distance(b.pos, owner.pos) ? a : b));
    const toGoal = sub(myGoal, owner.pos);
    const ballToGoal = length(toGoal);
    const lane = normalize(toGoal);

    if (closest.id === bot.id) {
      // Press goal-side: meet the carrier on their path to our goal, leading their velocity, so a
      // straight sprint from kickoff runs into the defender instead of away from them.
      const d = distance(bot.pos, owner.pos);
      const lead = scale(owner.vel, clamp(d / 8, 0, 0.6));
      const target = add(add(owner.pos, scale(lane, 0.9)), lead);
      const tackle = d < 1.05 && this.rng.chance(0.35 + this.personality.aggression * 0.5);
      const input = this.moveTo(bot, target, d > 2.0 && bot.stamina > 20);
      return { ...input, tackle };
    }

    // Last man: the teammate nearest our goal holds the ball–goal line just off the goal.
    const others = teammates.filter((p) => p.id !== closest.id);
    const lastMan = others.reduce((a, b) => (distance(a.pos, myGoal) < distance(b.pos, myGoal) ? a : b));
    if (lastMan.id === bot.id) {
      const depth = clamp(ballToGoal * 0.25, 1.6, 4.5);
      const target = sub(myGoal, scale(lane, depth));
      return this.moveTo(bot, target, ballToGoal < 10);
    }

    // Cover: stand in the shooting lane between carrier and goal — body blocks are real defence (§19, §23).
    const cover = add(owner.pos, scale(lane, clamp(ballToGoal * 0.4, 2.5, 7)));
    return this.moveTo(bot, cover, ballToGoal < 12);
  }

  private chaseLoose(bot: SimPlayer, ball: Vec2, state: SimState): PlayerInput {
    const teammates = state.players.filter((p) => p.team === bot.team);
    const closest = teammates.reduce((a, b) => (distance(a.pos, ball) < distance(b.pos, ball) ? a : b));
    if (closest.id === bot.id) {
      // Intercept: aim slightly ahead of the ball's travel.
      const lead = { x: ball.x + state.ball.vel.x * 0.25, z: ball.z + state.ball.vel.z * 0.25 };
      return this.moveTo(bot, lead, bot.stamina > 25);
    }
    // Others hold a balanced position in their half.
    const dir = attackDirection(bot.team);
    const home: Vec2 = { x: bot.pos.x * 0.5, z: -dir * state.court.length * 0.15 };
    return this.moveTo(bot, home, false);
  }

  // ---------------------------------------------------------------- helpers

  private moveTo(bot: SimPlayer, target: Vec2, sprint: boolean): PlayerInput {
    const to = sub(target, bot.pos);
    const d = length(to);
    const move = d < 0.3 ? { x: 0, z: 0 } : scale(normalize(to), clamp(d / 1.5, 0.3, 1));
    return { move, sprint, pass: false, lob: false, tackle: false };
  }

  private nearestOpponent(bot: SimPlayer, state: SimState): SimPlayer | null {
    let best: SimPlayer | null = null;
    let bd = Infinity;
    for (const p of state.players) {
      if (p.team === bot.team) continue;
      const d = distance(p.pos, bot.pos);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  /** Smallest perpendicular distance of an opponent to the segment from→to (Infinity if none). */
  private laneClearance(from: Vec2, to: Vec2, state: SimState, team: TeamId): number {
    const dir = normalize(sub(to, from));
    const len = distance(from, to);
    let clearance = Infinity;
    for (const p of state.players) {
      if (p.team === team) continue;
      const rel = sub(p.pos, from);
      const along = rel.x * dir.x + rel.z * dir.z;
      if (along < 0 || along > len) continue;
      const perp = Math.abs(rel.x * dir.z - rel.z * dir.x);
      if (perp < clearance) clearance = perp;
    }
    return clearance;
  }

  private laneOpen(from: Vec2, to: Vec2, state: SimState, team: TeamId): boolean {
    return this.laneClearance(from, to, state, team) >= PASS_LANE_CLEARANCE;
  }

  /**
   * Court-space side (-1 | 1) of the goal whose post lane is clearer, or null when both are
   * blocked. Ties go to +x, which keeps the choice identical in a mirrored court.
   */
  private openGoalSide(from: Vec2, state: SimState, team: TeamId): -1 | 1 | null {
    const goalZ = (state.court.length / 2) * attackDirection(team);
    const postX = (state.court.goalWidth / 2) * this.cfg.shot.placementRange;
    const left = this.laneClearance(from, { x: -postX, z: goalZ }, state, team);
    const right = this.laneClearance(from, { x: postX, z: goalZ }, state, team);
    if (Math.max(left, right) < SHOT_LANE_CLEARANCE) return null;
    return right >= left ? 1 : -1;
  }

  private bestPassOption(bot: SimPlayer, state: SimState): SimPlayer | null {
    const dir = attackDirection(bot.team);
    let best: SimPlayer | null = null;
    let bestScore = -Infinity;
    for (const p of state.players) {
      if (p.team !== bot.team || p.id === bot.id) continue;
      const opp = this.nearestOpponent(p, state);
      const space = opp ? distance(opp.pos, p.pos) : 10;
      const advance = (p.pos.z - bot.pos.z) * dir;
      const open = this.laneOpen(bot.pos, p.pos, state, bot.team) ? 2 : -3;
      const score = space + advance * 0.4 + open + this.rng.range(-0.5, 0.5);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    return best;
  }
}

const idle = (): PlayerInput => ({ move: { x: 0, z: 0 }, sprint: false, pass: false, lob: false, tackle: false });

/** Convenience for building a facing angle towards a point (used by clients for camera hints). */
export const facingTowards = (from: Vec2, to: Vec2): number => angleOf(sub(to, from));
