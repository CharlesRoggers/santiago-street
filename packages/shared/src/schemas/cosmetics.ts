import { z } from "zod";

/** All brands are fictional placeholders (§5) and must be cleared before commercial use. */
export const FICTIONAL_BRANDS = ["VANTA", "RUSH", "KICKR", "NEXO", "STREET9"] as const;
export const FictionalBrand = z.enum(FICTIONAL_BRANDS);

export const CosmeticSlot = z.enum([
  "SHIRT",
  "JACKET",
  "PANTS",
  "SHORTS",
  "FOOTWEAR",
  "HAT",
  "ACCESSORY",
  "HAIRSTYLE",
  "CELEBRATION",
  "ANIMATION"
]);
export type CosmeticSlot = z.infer<typeof CosmeticSlot>;

export const CosmeticSchema = z.object({
  id: z.string(),
  slot: CosmeticSlot,
  nameKey: z.string(),
  brand: FictionalBrand.nullable(),
  price: z.number().int().min(0),
  /** Cosmetics never change gameplay stats (§35: no pay-to-win). */
  rarity: z.enum(["COMMON", "RARE", "EPIC", "LEGENDARY"]),
  /** Asset reference; PLACEHOLDER_* ids are tracked in docs/production/placeholders.md */
  assetId: z.string()
});
export type Cosmetic = z.infer<typeof CosmeticSchema>;
