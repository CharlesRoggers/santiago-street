import type { Reward } from "../schemas/events";
import type { Tier } from "../schemas/player";
import { TIER_ORDER } from "../schemas/player";
import type { TeamId } from "../sim/types";

/**
 * Reward & progression rules (§34–§37, §136). Pure functions so the SERVER
 * computes them from a validated match result; the client only displays them.
 */

export interface MatchResultSummary {
  winner: TeamId | null;
  score: Record<TeamId, number>;
  durationSec: number;
  /** Court level 1..10 multiplies rewards (§30). */
  courtLevel: number;
  /** Streak of consecutive wins the player had BEFORE this match. */
  winStreak: number;
}

export interface PlayerMatchStats {
  team: TeamId;
  goals: number;
  assists: number;
}

export const REWARD_TABLE = {
  base: { win: { xp: 120, money: 80, reputation: 10 }, loss: { xp: 45, money: 20, reputation: 0 }, draw: { xp: 70, money: 40, reputation: 3 } },
  perGoal: { xp: 15, money: 5, reputation: 1 },
  perAssist: { xp: 10, money: 3, reputation: 1 },
  /** +8% per court level above 1. */
  courtLevelMultiplierStep: 0.08,
  /** +5% per consecutive win, capped. */
  streakStep: 0.05,
  streakCap: 0.5,
  /** Matches shorter than this are suspicious and earn nothing (anti-farm, §137). */
  minValidDurationSec: 45
} as const;

export function computeMatchReward(result: MatchResultSummary, player: PlayerMatchStats): Reward {
  if (result.durationSec < REWARD_TABLE.minValidDurationSec) {
    return { xp: 0, money: 0, reputation: 0, cosmeticIds: [] };
  }
  const outcome = result.winner === null ? "draw" : result.winner === player.team ? "win" : "loss";
  const base = REWARD_TABLE.base[outcome];

  const courtMult = 1 + Math.max(0, result.courtLevel - 1) * REWARD_TABLE.courtLevelMultiplierStep;
  const streakMult =
    outcome === "win" ? 1 + Math.min(REWARD_TABLE.streakCap, result.winStreak * REWARD_TABLE.streakStep) : 1;
  const mult = courtMult * streakMult;

  const xp = base.xp + player.goals * REWARD_TABLE.perGoal.xp + player.assists * REWARD_TABLE.perAssist.xp;
  const money = base.money + player.goals * REWARD_TABLE.perGoal.money + player.assists * REWARD_TABLE.perAssist.money;
  const rep =
    base.reputation +
    player.goals * REWARD_TABLE.perGoal.reputation +
    player.assists * REWARD_TABLE.perAssist.reputation;

  return {
    xp: Math.round(xp * mult),
    money: Math.round(money * mult),
    reputation: Math.round(rep * mult),
    cosmeticIds: []
  };
}

/** XP required to go from `level` to `level + 1`. Gentle curve, tuneable. */
export function xpForNextLevel(level: number): number {
  return Math.round(200 + 120 * (level - 1) + 18 * (level - 1) ** 2);
}

/** Total XP needed to REACH `level` from level 1. */
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpForNextLevel(l);
  return total;
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (xp >= totalXpForLevel(level + 1)) level++;
  return level;
}

/** Reputation thresholds for each tier (§37). Data, not code. */
export const TIER_REPUTATION: Record<Tier, number> = {
  BARRIO: 0,
  COMUNA: 250,
  CIUDAD: 900,
  REGIONAL: 2500,
  NACIONAL: 6000,
  INTERNACIONAL: 14000
};

export function tierFromReputation(reputation: number): Tier {
  let tier: Tier = "BARRIO";
  for (const t of TIER_ORDER) {
    if (reputation >= TIER_REPUTATION[t]) tier = t;
  }
  return tier;
}
