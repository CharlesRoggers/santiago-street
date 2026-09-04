import { z } from "zod";

/** Normalized attribute 0..1 (directive §69: normalized internal values). */
export const Attribute = z.number().min(0).max(1);

export const PlayerAttributesSchema = z.object({
  speed: Attribute,
  acceleration: Attribute,
  control: Attribute,
  dribble: Attribute,
  pass: Attribute,
  shot: Attribute,
  defense: Attribute,
  physical: Attribute,
  stamina: Attribute
});
export type PlayerAttributes = z.infer<typeof PlayerAttributesSchema>;

export const DEFAULT_ATTRIBUTES: PlayerAttributes = {
  speed: 0.5,
  acceleration: 0.5,
  control: 0.5,
  dribble: 0.5,
  pass: 0.5,
  shot: 0.5,
  defense: 0.5,
  physical: 0.5,
  stamina: 0.5
};

/** Gameplay archetypes (§68) — soft styles, not fixed classes. */
export const PlayerStyle = z.enum([
  "SPEEDSTER",
  "DRIBBLER",
  "PLAYMAKER",
  "FINISHER",
  "DEFENDER",
  "PHYSICAL",
  "HYBRID"
]);
export type PlayerStyle = z.infer<typeof PlayerStyle>;

/** Progression tiers (§37). Design categories, not real leagues. */
export const Tier = z.enum(["BARRIO", "COMUNA", "CIUDAD", "REGIONAL", "NACIONAL", "INTERNACIONAL"]);
export type Tier = z.infer<typeof Tier>;

export const TIER_ORDER: readonly Tier[] = [
  "BARRIO",
  "COMUNA",
  "CIUDAD",
  "REGIONAL",
  "NACIONAL",
  "INTERNACIONAL"
];

/** Persistent player profile (§67). Server-authoritative fields only. */
export const PlayerProfileSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(2).max(20),
  level: z.number().int().min(1),
  xp: z.number().int().min(0),
  reputation: z.number().int().min(0),
  money: z.number().int().min(0),
  tier: Tier,
  style: PlayerStyle,
  crewId: z.string().nullable(),
  attributes: PlayerAttributesSchema,
  stats: z.object({
    matchesPlayed: z.number().int().min(0),
    wins: z.number().int().min(0),
    losses: z.number().int().min(0),
    goals: z.number().int().min(0),
    assists: z.number().int().min(0),
    courtsControlled: z.number().int().min(0),
    tournamentsWon: z.number().int().min(0)
  }),
  unlockedCosmeticIds: z.array(z.string()),
  equippedCosmeticIds: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});
export type PlayerProfile = z.infer<typeof PlayerProfileSchema>;

export function createNewPlayerProfile(id: string, displayName: string, now = new Date()): PlayerProfile {
  const iso = now.toISOString();
  return {
    id,
    displayName,
    level: 1,
    xp: 0,
    reputation: 0,
    money: 0,
    tier: "BARRIO",
    style: "HYBRID",
    crewId: null,
    attributes: { ...DEFAULT_ATTRIBUTES },
    stats: {
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      goals: 0,
      assists: 0,
      courtsControlled: 0,
      tournamentsWon: 0
    },
    unlockedCosmeticIds: [],
    equippedCosmeticIds: [],
    createdAt: iso,
    updatedAt: iso
  };
}
