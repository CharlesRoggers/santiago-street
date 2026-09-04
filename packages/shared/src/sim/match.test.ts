import { describe, expect, it } from "vitest";
import { BotController } from "./ai";
import { DEFAULT_COURT, MatchSimulation, type MatchSetup } from "./match";
import { EMPTY_INPUT, type PlayerInput } from "./types";

const threeVthree = (): MatchSetup["players"] => [
  { id: "a1", team: "A", isHuman: true },
  { id: "a2", team: "A", isHuman: false },
  { id: "a3", team: "A", isHuman: false },
  { id: "b1", team: "B", isHuman: false },
  { id: "b2", team: "B", isHuman: false },
  { id: "b3", team: "B", isHuman: false }
];

const setup = (seed = 42): MatchSetup => ({ court: DEFAULT_COURT, players: threeVthree(), seed });

function runTicks(sim: MatchSimulation, n: number, inputs: (tick: number) => Map<string, PlayerInput> = () => new Map()) {
  const all = [];
  for (let i = 0; i < n; i++) {
    for (const [id, inp] of inputs(i)) sim.setInput(id, inp);
    all.push(...sim.step());
  }
  return all;
}

describe("MatchSimulation — match flow", () => {
  it("starts in KICKOFF and gives the ball to team A after the delay", () => {
    const sim = new MatchSimulation(setup());
    expect(sim.state.match.phase).toBe("KICKOFF");
    const events = runTicks(sim, 90);
    expect(sim.state.match.phase).toBe("PLAYING");
    expect(sim.state.ball.ownerId).toBe("a1");
    expect(events.some((e) => e.type === "KICKOFF" && e.team === "A")).toBe(true);
  });

  it("is deterministic: same seed + same inputs → identical state", () => {
    const run = () => {
      const sim = new MatchSimulation(setup(7));
      const bots = new BotController(7);
      for (let i = 0; i < 60 * 30; i++) {
        for (const [id, inp] of bots.computeInputs(sim.state, sim.dt)) sim.setInput(id, inp);
        sim.setInput("a1", { ...EMPTY_INPUT, move: { x: 0.3, z: 1 }, sprint: i % 120 < 60 });
        sim.step();
      }
      return JSON.stringify(sim.state);
    };
    expect(run()).toBe(run());
  });

  it("registers a goal when the ball crosses the goal line inside the mouth", () => {
    const sim = new MatchSimulation(setup());
    runTicks(sim, 90);
    // Teleport loose ball just in front of team A's target goal (+z) and fire it in.
    const owner = sim.getPlayer(sim.state.ball.ownerId!)!;
    owner.hasBall = false;
    sim.state.ball.ownerId = null;
    sim.state.ball.pos = { x: 0, y: 0.11, z: DEFAULT_COURT.length / 2 - 2 };
    sim.state.ball.vel = { x: 0, y: 0, z: 15 };
    sim.state.ball.lastTouchId = "a2";
    // Move everyone away so nobody intercepts.
    for (const p of sim.state.players) p.pos = { x: -8, z: -10 };
    const events = runTicks(sim, 30);
    const goal = events.find((e) => e.type === "GOAL");
    expect(goal).toBeDefined();
    expect(goal?.type === "GOAL" && goal.team).toBe("A");
    expect(goal?.type === "GOAL" && goal.scorerId).toBe("a2");
    expect(sim.state.match.score.A).toBe(1);
    expect(sim.state.match.phase).toBe("GOAL");
    expect(sim.state.match.kickoffTeam).toBe("B");
  });

  it("bounces off the end wall when outside the goal mouth", () => {
    const sim = new MatchSimulation(setup());
    runTicks(sim, 90);
    const owner = sim.getPlayer(sim.state.ball.ownerId!)!;
    owner.hasBall = false;
    sim.state.ball.ownerId = null;
    sim.state.ball.pos = { x: 6, y: 0.11, z: DEFAULT_COURT.length / 2 - 2 };
    sim.state.ball.vel = { x: 0, y: 0, z: 15 };
    for (const p of sim.state.players) p.pos = { x: -8, z: -10 };
    const events = runTicks(sim, 30);
    expect(events.some((e) => e.type === "GOAL")).toBe(false);
    expect(events.some((e) => e.type === "BALL_WALL")).toBe(true);
    expect(sim.state.ball.vel.z).toBeLessThan(0);
  });

  it("finishes when the target score is reached", () => {
    const sim = new MatchSimulation({ ...setup(), rules: { format: "3v3", ruleset: "FIRST_TO", targetScore: 1, durationSec: 600, endOnEither: true } });
    runTicks(sim, 90);
    const owner = sim.getPlayer(sim.state.ball.ownerId!)!;
    owner.hasBall = false;
    sim.state.ball.ownerId = null;
    sim.state.ball.pos = { x: 0, y: 0.11, z: DEFAULT_COURT.length / 2 - 1 };
    sim.state.ball.vel = { x: 0, y: 0, z: 15 };
    for (const p of sim.state.players) p.pos = { x: -8, z: -10 };
    const events = runTicks(sim, 60 * 4);
    expect(sim.state.match.phase).toBe("FINISHED");
    expect(sim.state.match.winner).toBe("A");
    expect(events.some((e) => e.type === "MATCH_END")).toBe(true);
  });

  it("finishes when time expires", () => {
    const sim = new MatchSimulation({ ...setup(), rules: { format: "3v3", ruleset: "TIMED", targetScore: 99, durationSec: 60, endOnEither: false } });
    runTicks(sim, 60 * 62);
    expect(sim.state.match.phase).toBe("FINISHED");
  });
});

describe("MatchSimulation — football actions", () => {
  it("passing releases the ball towards a teammate and sets kick cooldown", () => {
    const sim = new MatchSimulation(setup());
    runTicks(sim, 90);
    const a1 = sim.getPlayer("a1")!;
    const a2 = sim.getPlayer("a2")!;
    a2.pos = { x: 5, z: a1.pos.z };
    sim.setInput("a1", { ...EMPTY_INPUT, pass: true, passTargetId: "a2" });
    const events = sim.step();
    expect(events.some((e) => e.type === "PASS" && e.toId === "a2")).toBe(true);
    expect(sim.state.ball.ownerId).toBeNull();
    expect(sim.state.ball.vel.x).toBeGreaterThan(3);
    expect(a1.kickCooldown).toBeGreaterThan(0);
  });

  it("shooting produces a fast ball towards the attacking goal", () => {
    const sim = new MatchSimulation(setup());
    runTicks(sim, 90);
    sim.setInput("a1", { ...EMPTY_INPUT, shootPower: 1 });
    const events = sim.step();
    expect(events.some((e) => e.type === "SHOT")).toBe(true);
    expect(sim.state.ball.vel.z).toBeGreaterThan(10); // team A attacks +z
    expect(sim.state.ball.vel.y).toBeGreaterThan(0);
  });

  it("a nearby opponent can regain a loose ball", () => {
    const sim = new MatchSimulation(setup());
    runTicks(sim, 90);
    const a1 = sim.getPlayer("a1")!;
    a1.hasBall = false;
    sim.state.ball.ownerId = null;
    sim.state.ball.vel = { x: 0, y: 0, z: 0 };
    const b1 = sim.getPlayer("b1")!;
    b1.pos = { x: sim.state.ball.pos.x + 0.3, z: sim.state.ball.pos.z };
    a1.pos = { x: -9, z: -12 };
    sim.step();
    expect(sim.state.ball.ownerId).toBe("b1");
  });

  it("sprinting drains stamina and resting regenerates it", () => {
    const sim = new MatchSimulation(setup());
    runTicks(sim, 90);
    const a1 = sim.getPlayer("a1")!;
    runTicks(sim, 120, () => new Map([["a1", { ...EMPTY_INPUT, move: { x: 1, z: 0 }, sprint: true }]]));
    const drained = a1.stamina;
    expect(drained).toBeLessThan(sim.cfg.stamina.max);
    runTicks(sim, 180);
    expect(a1.stamina).toBeGreaterThan(drained);
  });

  it("players never leave the court", () => {
    const sim = new MatchSimulation(setup());
    runTicks(sim, 60 * 8, () => new Map([["a1", { ...EMPTY_INPUT, move: { x: 1, z: 1 }, sprint: true }]]));
    const a1 = sim.getPlayer("a1")!;
    expect(Math.abs(a1.pos.x)).toBeLessThanOrEqual(DEFAULT_COURT.width / 2);
    expect(Math.abs(a1.pos.z)).toBeLessThanOrEqual(DEFAULT_COURT.length / 2);
  });
});

describe("BotController (PROTOTYPE)", () => {
  it("bots-only match produces goals within a few minutes and stays stable", () => {
    const players = threeVthree().map((p) => ({ ...p, isHuman: false }));
    const sim = new MatchSimulation({ court: DEFAULT_COURT, players, seed: 3, rules: { format: "3v3", ruleset: "FIRST_TO", targetScore: 5, durationSec: 300, endOnEither: true } });
    const bots = new BotController(3);
    let goals = 0;
    for (let i = 0; i < 60 * 300 && sim.state.match.phase !== "FINISHED"; i++) {
      for (const [id, inp] of bots.computeInputs(sim.state, sim.dt)) sim.setInput(id, inp);
      for (const e of sim.step()) if (e.type === "GOAL") goals++;
    }
    expect(goals).toBeGreaterThan(0);
    for (const p of sim.state.players) {
      expect(Number.isFinite(p.pos.x) && Number.isFinite(p.pos.z)).toBe(true);
    }
    expect(Number.isFinite(sim.state.ball.pos.x)).toBe(true);
  });
});
