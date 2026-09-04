import { z } from "zod";
import { Tier } from "./player";

export const MatchFormat = z.enum(["1v1", "2v2", "3v3", "4v4", "5v5"]);
export type MatchFormat = z.infer<typeof MatchFormat>;

/** §26 rule variants. Only FIRST_TO / TIMED are implemented in the sim today. */
export const MatchRuleset = z.enum([
  "FIRST_TO",
  "TIMED",
  "GOLDEN_GOAL",
  "KING_OF_THE_COURT",
  "ELIMINATION"
]);
export type MatchRuleset = z.infer<typeof MatchRuleset>;

export const MatchRulesSchema = z.object({
  format: MatchFormat,
  ruleset: MatchRuleset,
  /** Score that ends the match (FIRST_TO). */
  targetScore: z.number().int().min(1).max(20),
  /** Duration in seconds (TIMED, or cap for FIRST_TO). */
  durationSec: z.number().int().min(60).max(1200),
  /** Optional: match ends when both conditions are possible (§26: first to X OR time). */
  endOnEither: z.boolean().default(true)
});
export type MatchRules = z.infer<typeof MatchRulesSchema>;

export const DEFAULT_3V3_RULES: MatchRules = {
  format: "3v3",
  ruleset: "FIRST_TO",
  targetScore: 5,
  durationSec: 360,
  endOnEither: true
};

export const RewardSchema = z.object({
  xp: z.number().int().min(0),
  money: z.number().int().min(0),
  reputation: z.number().int().min(0),
  cosmeticIds: z.array(z.string()).default([])
});
export type Reward = z.infer<typeof RewardSchema>;

export const EventType = z.enum([
  "OPEN_COURT",
  "KING_OF_THE_COURT",
  "NIGHT_CHALLENGE",
  "NEIGHBORHOOD_TOURNAMENT",
  "CREW_BATTLE",
  "STREET_CHAMPIONSHIP",
  "REGIONAL_CHALLENGE"
]);

export const WorldEventSchema = z.object({
  id: z.string(),
  type: EventType,
  nameKey: z.string(),
  courtId: z.string(),
  startsAt: z.string().datetime(),
  durationMin: z.number().int().min(5),
  requirements: z.object({
    minTier: Tier.optional(),
    minReputation: z.number().int().min(0).optional(),
    crewRequired: z.boolean().default(false)
  }),
  difficulty: z.number().int().min(1).max(10),
  reward: RewardSchema,
  rules: MatchRulesSchema
});
export type WorldEvent = z.infer<typeof WorldEventSchema>;

export const TournamentFormat = z.enum(["SINGLE_ELIMINATION", "ROUND_ROBIN", "KING_OF_THE_COURT"]);

export const TournamentSchema = z.object({
  id: z.string(),
  nameKey: z.string(),
  courtId: z.string(),
  entryRequirements: z.object({
    minTier: Tier,
    minReputation: z.number().int().min(0),
    entryFee: z.number().int().min(0),
    crewRequired: z.boolean()
  }),
  format: TournamentFormat,
  maxTeams: z.number().int().min(2).max(32),
  rules: MatchRulesSchema,
  rewards: z.object({
    winner: RewardSchema,
    runnerUp: RewardSchema,
    participant: RewardSchema
  }),
  startsAt: z.string().datetime(),
  durationMin: z.number().int().min(10)
});
export type Tournament = z.infer<typeof TournamentSchema>;

/** Lightweight objectives (§112) — no traditional mission system yet. */
export const ObjectiveSchema = z.object({
  id: z.string(),
  descriptionKey: z.string(),
  kind: z.enum([
    "WIN_MATCHES",
    "SCORE_GOALS",
    "DEFEAT_CREW",
    "HOLD_COURT",
    "JOIN_EVENT",
    "TRAVEL_TO_DISTRICT"
  ]),
  target: z.number().int().min(1),
  reward: RewardSchema
});
export type Objective = z.infer<typeof ObjectiveSchema>;
