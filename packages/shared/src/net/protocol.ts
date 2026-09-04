import { z } from "zod";

/**
 * Client ⇄ server message contracts (§57). Validated with zod on the server:
 * the client is never trusted (§56).
 */

export const Vec2Schema = z.object({ x: z.number().min(-1).max(1), z: z.number().min(-1).max(1) });

export const ClientInputMessage = z.object({
  /** Client-side tick this input was produced for (for reconciliation). */
  tick: z.number().int().min(0),
  move: Vec2Schema,
  sprint: z.boolean(),
  pass: z.boolean(),
  lob: z.boolean(),
  shootPower: z.number().min(0).max(1).optional(),
  tackle: z.boolean(),
  passTargetId: z.string().max(64).optional()
});
export type ClientInputMessage = z.infer<typeof ClientInputMessage>;

export const MESSAGES = {
  /** client → server */
  INPUT: "input",
  READY: "ready",
  /** server → client */
  MATCH_EVENTS: "events",
  MATCH_RESULT: "result"
} as const;

export const MatchResultMessage = z.object({
  winner: z.enum(["A", "B"]).nullable(),
  score: z.object({ A: z.number().int(), B: z.number().int() }),
  durationSec: z.number(),
  rewards: z.record(
    z.string(),
    z.object({ xp: z.number().int(), money: z.number().int(), reputation: z.number().int() })
  )
});
export type MatchResultMessage = z.infer<typeof MatchResultMessage>;
