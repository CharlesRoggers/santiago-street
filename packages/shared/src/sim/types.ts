import type { Vec2 } from "../math/vec2";
import type { PlayerAttributes } from "../schemas/player";
import type { CourtDimensions } from "../schemas/world";
import type { MatchRules } from "../schemas/events";

export type TeamId = "A" | "B";

/**
 * Per-tick input for one player. Produced by the local input layer (keyboard,
 * touch, gamepad) or by an AI controller — the sim treats both identically,
 * which is what makes server-side validation possible (§56).
 */
export interface PlayerInput {
  /** Desired movement direction in court space, magnitude 0..1. */
  move: Vec2;
  sprint: boolean;
  /** Rising-edge actions: true only on the tick the button is released/pressed. */
  pass: boolean;
  lob: boolean;
  /** Shot released this tick with the given charge 0..1 (undefined = no shot). */
  shootPower?: number;
  tackle: boolean;
  /** Optional explicit pass target (player id) — otherwise auto-target by direction. */
  passTargetId?: string;
}

export const EMPTY_INPUT: Readonly<PlayerInput> = Object.freeze({
  move: { x: 0, z: 0 },
  sprint: false,
  pass: false,
  lob: false,
  tackle: false
});

export interface SimPlayer {
  id: string;
  team: TeamId;
  /** Whether a human controls this player (affects nothing in the sim; used by AI/camera). */
  isHuman: boolean;
  attributes: PlayerAttributes;
  pos: Vec2;
  vel: Vec2;
  /** Facing angle in radians (atan2(z, x)). */
  facing: number;
  stamina: number;
  /** Seconds since last sprint (for regen delay). */
  sinceSprint: number;
  /** Seconds the player is unable to act (after failed tackle / being tackled). */
  stun: number;
  /** Cooldowns in seconds. */
  kickCooldown: number;
  loseCooldown: number;
  tackleCooldown: number;
  /** Convenience flag mirrored from ball.ownerId. */
  hasBall: boolean;
}

export interface SimBall {
  pos: { x: number; y: number; z: number };
  vel: { x: number; y: number; z: number };
  /** Player controlling the ball, or null when loose. */
  ownerId: string | null;
  lastTouchId: string | null;
  /** Second-to-last toucher on the same team (for assists). */
  assistCandidateId: string | null;
}

export type MatchPhase = "WARMUP" | "KICKOFF" | "PLAYING" | "GOAL" | "FINISHED";

export type SimEvent =
  | { type: "KICKOFF"; team: TeamId }
  | { type: "PASS"; fromId: string; toId: string | null; lob: boolean }
  | { type: "SHOT"; playerId: string; power: number }
  | { type: "GOAL"; team: TeamId; scorerId: string; assistId: string | null; ownGoal: boolean }
  | { type: "TACKLE"; tacklerId: string; victimId: string; success: boolean }
  | { type: "POSSESSION"; playerId: string }
  | { type: "BALL_WALL" | "BALL_BOUNCE"; speed: number }
  | { type: "MATCH_END"; winner: TeamId | null };

export interface MatchState {
  phase: MatchPhase;
  /** Seconds elapsed in PLAYING phase. */
  clock: number;
  /** Seconds remaining in the current transitional phase. */
  phaseTimer: number;
  score: Record<TeamId, number>;
  /** Team that takes the next kickoff. */
  kickoffTeam: TeamId;
  winner: TeamId | null;
  tick: number;
}

export interface SimState {
  court: CourtDimensions;
  rules: MatchRules;
  players: SimPlayer[];
  ball: SimBall;
  match: MatchState;
}

/** Which goal (z sign) a team attacks. Team A attacks +z, team B attacks -z. */
export const attackDirection = (team: TeamId): 1 | -1 => (team === "A" ? 1 : -1);
export const opponentOf = (team: TeamId): TeamId => (team === "A" ? "B" : "A");
