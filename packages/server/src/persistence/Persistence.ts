import type { PlayerProfile, Reward } from "@ss/shared";
import { createNewPlayerProfile, levelFromXp, tierFromReputation } from "@ss/shared";

/**
 * Persistence abstraction (§135). Gameplay code depends on this interface
 * only; the concrete adapter is chosen by configuration. Adapters:
 *   - MemoryPersistence  — IMPLEMENTED (development / tests only, data is lost on restart)
 *   - PostgresPersistence — PLANNED (Supabase/Postgres), see docs/adr/ADR-005
 */
export interface Persistence {
  getOrCreateProfile(playerId: string, displayName: string): Promise<PlayerProfile>;
  /** Atomically apply a validated reward. Never callable from the client (§136). */
  applyReward(playerId: string, reward: Reward, outcome: "win" | "loss" | "draw", goals: number, assists: number): Promise<PlayerProfile>;
  recordMatch(record: MatchRecord): Promise<void>;
}

export interface MatchRecord {
  matchId: string;
  courtId: string;
  startedAt: string;
  endedAt: string;
  durationSec: number;
  score: { A: number; B: number };
  winner: "A" | "B" | null;
  participants: Array<{ playerId: string; team: "A" | "B"; goals: number; assists: number; isBot: boolean }>;
  seed: number;
}

export class MemoryPersistence implements Persistence {
  private profiles = new Map<string, PlayerProfile>();
  readonly matches: MatchRecord[] = [];

  async getOrCreateProfile(playerId: string, displayName: string): Promise<PlayerProfile> {
    let p = this.profiles.get(playerId);
    if (!p) {
      p = createNewPlayerProfile(playerId, displayName);
      this.profiles.set(playerId, p);
    }
    return p;
  }

  async applyReward(playerId: string, reward: Reward, outcome: "win" | "loss" | "draw", goals: number, assists: number): Promise<PlayerProfile> {
    const p = await this.getOrCreateProfile(playerId, playerId);
    p.xp += reward.xp;
    p.money += reward.money;
    p.reputation += reward.reputation;
    p.level = levelFromXp(p.xp);
    p.tier = tierFromReputation(p.reputation);
    p.stats.matchesPlayed++;
    if (outcome === "win") p.stats.wins++;
    if (outcome === "loss") p.stats.losses++;
    p.stats.goals += goals;
    p.stats.assists += assists;
    for (const c of reward.cosmeticIds) if (!p.unlockedCosmeticIds.includes(c)) p.unlockedCosmeticIds.push(c);
    p.updatedAt = new Date().toISOString();
    return p;
  }

  async recordMatch(record: MatchRecord): Promise<void> {
    this.matches.push(record);
  }
}
