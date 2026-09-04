import { describe, expect, it } from "vitest";
import { computeMatchReward, levelFromXp, tierFromReputation, totalXpForLevel, xpForNextLevel } from "./rewards";

describe("rewards", () => {
  const base = { score: { A: 5, B: 2 }, durationSec: 240, courtLevel: 1, winStreak: 0 } as const;

  it("winners earn more than losers", () => {
    const win = computeMatchReward({ ...base, winner: "A" }, { team: "A", goals: 0, assists: 0 });
    const loss = computeMatchReward({ ...base, winner: "A" }, { team: "B", goals: 0, assists: 0 });
    expect(win.xp).toBeGreaterThan(loss.xp);
    expect(win.money).toBeGreaterThan(loss.money);
    expect(win.reputation).toBeGreaterThan(loss.reputation);
  });

  it("goals and assists add to the reward", () => {
    const plain = computeMatchReward({ ...base, winner: "A" }, { team: "A", goals: 0, assists: 0 });
    const scorer = computeMatchReward({ ...base, winner: "A" }, { team: "A", goals: 3, assists: 1 });
    expect(scorer.xp).toBeGreaterThan(plain.xp);
  });

  it("court level and win streak multiply rewards", () => {
    const l1 = computeMatchReward({ ...base, winner: "A" }, { team: "A", goals: 0, assists: 0 });
    const l5 = computeMatchReward({ ...base, winner: "A", courtLevel: 5 }, { team: "A", goals: 0, assists: 0 });
    const streak = computeMatchReward({ ...base, winner: "A", winStreak: 4 }, { team: "A", goals: 0, assists: 0 });
    expect(l5.xp).toBeGreaterThan(l1.xp);
    expect(streak.money).toBeGreaterThan(l1.money);
  });

  it("suspiciously short matches earn nothing (anti-farm)", () => {
    const r = computeMatchReward({ ...base, winner: "A", durationSec: 10 }, { team: "A", goals: 5, assists: 0 });
    expect(r).toEqual({ xp: 0, money: 0, reputation: 0, cosmeticIds: [] });
  });

  it("level curve is monotonic and consistent", () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(totalXpForLevel(5))).toBe(5);
    expect(levelFromXp(totalXpForLevel(5) - 1)).toBe(4);
    expect(xpForNextLevel(10)).toBeGreaterThan(xpForNextLevel(2));
  });

  it("tiers follow reputation thresholds", () => {
    expect(tierFromReputation(0)).toBe("BARRIO");
    expect(tierFromReputation(300)).toBe("COMUNA");
    expect(tierFromReputation(20000)).toBe("INTERNACIONAL");
  });
});
