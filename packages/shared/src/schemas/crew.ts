import { z } from "zod";

export const CrewRank = z.enum(["FOUNDER", "CAPTAIN", "VETERAN", "MEMBER", "ROOKIE"]);
export type CrewRank = z.infer<typeof CrewRank>;

export const CrewPermission = z.enum([
  "INVITE",
  "KICK",
  "PROMOTE",
  "CHALLENGE_COURT",
  "EDIT_IDENTITY",
  "MANAGE_PERMISSIONS"
]);
export type CrewPermission = z.infer<typeof CrewPermission>;

/** Default permission matrix (§32) — configurable per crew later. */
export const DEFAULT_CREW_PERMISSIONS: Record<CrewRank, CrewPermission[]> = {
  FOUNDER: ["INVITE", "KICK", "PROMOTE", "CHALLENGE_COURT", "EDIT_IDENTITY", "MANAGE_PERMISSIONS"],
  CAPTAIN: ["INVITE", "KICK", "PROMOTE", "CHALLENGE_COURT", "EDIT_IDENTITY"],
  VETERAN: ["INVITE", "CHALLENGE_COURT"],
  MEMBER: ["CHALLENGE_COURT"],
  ROOKIE: []
};

/**
 * Crew identity: logo is chosen from a curated library, never an upload (§72).
 */
export const CrewIdentitySchema = z.object({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  logoId: z.string(),
  bannerId: z.string(),
  mottoKey: z.string().nullable()
});

export const CrewSchema = z.object({
  id: z.string(),
  name: z.string().min(3).max(24),
  tag: z.string().min(2).max(4),
  identity: CrewIdentitySchema,
  members: z.array(
    z.object({
      playerId: z.string(),
      rank: CrewRank,
      joinedAt: z.string().datetime()
    })
  ),
  reputation: z.number().int().min(0),
  ranking: z.number().int().min(0),
  controlledCourtIds: z.array(z.string()),
  stats: z.object({
    wins: z.number().int().min(0),
    losses: z.number().int().min(0),
    courtsTaken: z.number().int().min(0),
    courtsLost: z.number().int().min(0)
  }),
  createdAt: z.string().datetime()
});
export type Crew = z.infer<typeof CrewSchema>;
