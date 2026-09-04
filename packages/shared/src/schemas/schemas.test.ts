import { describe, expect, it } from "vitest";
import { CourtDefinitionSchema, CrewSchema, DEFAULT_CREW_PERMISSIONS, createNewPlayerProfile, PlayerProfileSchema } from ".";

describe("schemas", () => {
  it("new player profile validates", () => {
    const p = createNewPlayerProfile("p1", "Carlitos");
    expect(PlayerProfileSchema.safeParse(p).success).toBe(true);
  });

  it("rejects out-of-range attributes", () => {
    const p = createNewPlayerProfile("p1", "Carlitos");
    p.attributes.speed = 1.4;
    expect(PlayerProfileSchema.safeParse(p).success).toBe(false);
  });

  it("court definition requires localization keys, not raw names", () => {
    const result = CourtDefinitionSchema.safeParse({
      id: "court.plaza-norte",
      districtId: "d.barrio-alto-fic",
      nameKey: "court.plaza_norte.name",
      dimensions: { width: 20, length: 32, goalWidth: 3, goalHeight: 1.8, wallHeight: 3 },
      surface: "ASPHALT",
      position: { x: 0, y: 0, z: 0 },
      yaw: 0,
      hasLights: true,
      baseLevel: 1
    });
    expect(result.success).toBe(true);
  });

  it("crew logos are library ids and founder has all permissions", () => {
    expect(DEFAULT_CREW_PERMISSIONS.FOUNDER).toContain("MANAGE_PERMISSIONS");
    expect(DEFAULT_CREW_PERMISSIONS.ROOKIE).toHaveLength(0);
    const crew = CrewSchema.safeParse({
      id: "c1",
      name: "Los del Cerro",
      tag: "LDC",
      identity: { primaryColor: "#ff3300", secondaryColor: "#111111", logoId: "logo.lib.01", bannerId: "banner.lib.01", mottoKey: null },
      members: [],
      reputation: 0,
      ranking: 0,
      controlledCourtIds: [],
      stats: { wins: 0, losses: 0, courtsTaken: 0, courtsLost: 0 },
      createdAt: new Date().toISOString()
    });
    expect(crew.success).toBe(true);
  });
});
