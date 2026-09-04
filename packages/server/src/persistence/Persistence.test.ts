import { describe, expect, it } from "vitest";
import { MemoryPersistence } from "./Persistence";

describe("MemoryPersistence", () => {
  it("applies rewards atomically and derives level/tier", async () => {
    const p = new MemoryPersistence();
    await p.getOrCreateProfile("carlos", "Carlos");
    const after = await p.applyReward("carlos", { xp: 500, money: 100, reputation: 300, cosmeticIds: ["c1", "c1"] }, "win", 2, 1);
    expect(after.xp).toBe(500);
    expect(after.level).toBeGreaterThanOrEqual(2);
    expect(after.tier).toBe("COMUNA");
    expect(after.stats.wins).toBe(1);
    expect(after.stats.goals).toBe(2);
    expect(after.unlockedCosmeticIds).toEqual(["c1"]);
  });
});
