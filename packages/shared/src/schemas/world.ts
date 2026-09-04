import { z } from "zod";

/**
 * World content model (§38): CITY → DISTRICTS → COURTS → EVENTS → TOURNAMENTS.
 * Nothing here hardcodes Santiago; the first city is just content in
 * `packages/content/cities/santiago-street/`.
 */

export const CourtState = z.enum([
  "NEUTRAL",
  "NPC_CONTROLLED",
  "CREW_CONTROLLED",
  "DISPUTED",
  "EVENT",
  "LOCKED"
]);
export type CourtState = z.infer<typeof CourtState>;

export const CourtSurface = z.enum(["ASPHALT", "CONCRETE", "TURF", "DIRT", "TILE"]);

/** Court dimensions in metres. 3v3 street courts are small. */
export const CourtDimensionsSchema = z.object({
  width: z.number().min(10).max(40),
  length: z.number().min(15).max(60),
  goalWidth: z.number().min(1.5).max(5),
  goalHeight: z.number().min(1).max(2.5),
  /** Wall height around the court; 0 = open court, ball can leave. */
  wallHeight: z.number().min(0).max(6)
});
export type CourtDimensions = z.infer<typeof CourtDimensionsSchema>;

export const CourtDefinitionSchema = z.object({
  id: z.string().min(1),
  districtId: z.string().min(1),
  /** Localization key, never a raw user-facing string (§86). */
  nameKey: z.string().min(1),
  dimensions: CourtDimensionsSchema,
  surface: CourtSurface,
  /** World position of the court centre (metres) and yaw (radians). */
  position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  yaw: z.number(),
  hasLights: z.boolean(),
  /** 1..10 — drives opponent strength and reward multiplier (§30). */
  baseLevel: z.number().int().min(1).max(10),
  tags: z.array(z.string()).default([])
});
export type CourtDefinition = z.infer<typeof CourtDefinitionSchema>;

/** Runtime/persisted state of a court — separate from its static definition (§60). */
export const CourtRuntimeStateSchema = z.object({
  courtId: z.string(),
  state: CourtState,
  controllingCrewId: z.string().nullable(),
  reputation: z.number().int().min(0),
  level: z.number().int().min(1).max(10),
  wins: z.number().int().min(0),
  losses: z.number().int().min(0),
  /** King-of-the-court streak of the current holder (§28). */
  holderStreak: z.number().int().min(0)
});
export type CourtRuntimeState = z.infer<typeof CourtRuntimeStateSchema>;

export const MetroStationSchema = z.object({
  id: z.string(),
  districtId: z.string(),
  nameKey: z.string(),
  lineId: z.string(),
  position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  discoveredByDefault: z.boolean().default(false)
});

export const DistrictSchema = z.object({
  id: z.string(),
  cityId: z.string(),
  nameKey: z.string(),
  /** Minimum tier required to unlock (§37). */
  requiredTier: z.enum(["BARRIO", "COMUNA", "CIUDAD", "REGIONAL", "NACIONAL", "INTERNACIONAL"]),
  courtIds: z.array(z.string()),
  metroStationIds: z.array(z.string()),
  /** Streaming cells this district spans (see ADR-004). */
  cellIds: z.array(z.string())
});
export type District = z.infer<typeof DistrictSchema>;

export const CitySchema = z.object({
  id: z.string(),
  nameKey: z.string(),
  countryCode: z.string().length(2),
  /** Metro brand is fictional per §42. */
  metroBrandKey: z.string(),
  districtIds: z.array(z.string())
});
export type City = z.infer<typeof CitySchema>;

export const DiscoveryState = z.enum(["UNKNOWN", "PARTIALLY_DISCOVERED", "DISCOVERED"]);
export type DiscoveryState = z.infer<typeof DiscoveryState>;
