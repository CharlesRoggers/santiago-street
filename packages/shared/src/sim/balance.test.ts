import { describe, expect, it } from "vitest";
import type { MatchRules } from "../schemas/events";
import { BotController } from "./ai";
import { DEFAULT_COURT, MatchSimulation, type MatchSetup, type PlayerSpec } from "./match";
import { attackDirection, EMPTY_INPUT, type PlayerInput, type SimState, type TeamId } from "./types";

/**
 * Balance harness (§150 quality bar, §153 honest status).
 *
 * The owner's machine cannot run the game, so the CI log is the playtest notebook:
 * bots-vs-bots matches over many seeds, printed as one table row per variant —
 * side symmetry, kickoff exploitability, shot conversion, tackle rates.
 * Everything is seeded, so a number that moves was moved by code.
 *
 * Targets asserted below are the "fun" bar for the core loop, not physics truths:
 * no side bias, shots are not automatic goals, kickoffs are not free goals.
 */
const SEEDS = 32;
const seeds = (): number[] => Array.from({ length: SEEDS }, (_, i) => 1000 + i * 7919);
const RULES: MatchRules = {
  format: "3v3",
  ruleset: "FIRST_TO",
  targetScore: 5,
  durationSec: 300,
  endOnEither: true
};
/** A goal this soon after a kickoff, by the kicking team, is a "kickoff goal". */
const KICKOFF_WINDOW_SEC = 8;
/** PLAYING time plus every possible kickoff countdown and goal celebration. */
const MAX_TICKS = (RULES.durationSec + 60) * 60;

interface TeamStats {
  goals: number;
  shots: number;
  shotDistance: number;
  tackles: number;
  tacklesWon: number;
  passes: number;
  possessionTicks: number;
}

interface MatchResult {
  finished: boolean;
  winner: TeamId | null;
  firstScorer: TeamId | null;
  goals: number;
  kickoffGoals: number;
  counterGoals: number;
  clock: number;
  teams: Record<TeamId, TeamStats>;
}

interface Variant {
  name: string;
  /** Order of the players array — detects iteration-order bias. */
  order: "AB" | "BA";
  kickoffTeam?: TeamId;
}

const emptyTeam = (): TeamStats => ({
  goals: 0,
  shots: 0,
  shotDistance: 0,
  tackles: 0,
  tacklesWon: 0,
  passes: 0,
  possessionTicks: 0
});

function roster(order: "AB" | "BA"): PlayerSpec[] {
  const a: PlayerSpec[] = ["a1", "a2", "a3"].map((id): PlayerSpec => ({ id, team: "A", isHuman: false }));
  const b: PlayerSpec[] = ["b1", "b2", "b3"].map((id): PlayerSpec => ({ id, team: "B", isHuman: false }));
  return order === "AB" ? [...a, ...b] : [...b, ...a];
}

function playBots(seed: number, v: Variant): MatchResult {
  const setup: MatchSetup = { court: DEFAULT_COURT, rules: RULES, seed, players: roster(v.order) };
  if (v.kickoffTeam) setup.kickoffTeam = v.kickoffTeam;
  const sim = new MatchSimulation(setup);
  const bots = new BotController(seed);
  const teamOf = (id: string): TeamId | null => sim.getPlayer(id)?.team ?? null;
  const halfL = DEFAULT_COURT.length / 2;
  const r: MatchResult = {
    finished: false,
    winner: null,
    firstScorer: null,
    goals: 0,
    kickoffGoals: 0,
    counterGoals: 0,
    clock: 0,
    teams: { A: emptyTeam(), B: emptyTeam() }
  };
  let lastKickoff: { team: TeamId; clock: number } | null = null;

  for (let tick = 0; tick < MAX_TICKS && sim.state.match.phase !== "FINISHED"; tick++) {
    for (const [id, inp] of bots.computeInputs(sim.state, sim.dt)) sim.setInput(id, inp);
    const ownerTeam = sim.state.ball.ownerId ? teamOf(sim.state.ball.ownerId) : null;
    if (ownerTeam) r.teams[ownerTeam].possessionTicks++;

    for (const e of sim.step()) {
      switch (e.type) {
        case "KICKOFF":
          lastKickoff = { team: e.team, clock: sim.state.match.clock };
          break;
        case "GOAL": {
          r.goals++;
          r.teams[e.team].goals++;
          r.firstScorer ??= e.team;
          if (lastKickoff && sim.state.match.clock - lastKickoff.clock < KICKOFF_WINDOW_SEC) {
            if (e.team === lastKickoff.team) r.kickoffGoals++;
            else r.counterGoals++;
          }
          break;
        }
        case "SHOT": {
          const p = sim.getPlayer(e.playerId);
          if (p) {
            r.teams[p.team].shots++;
            const goalZ = halfL * attackDirection(p.team);
            r.teams[p.team].shotDistance += Math.hypot(p.pos.x, goalZ - p.pos.z);
          }
          break;
        }
        case "TACKLE": {
          const t = teamOf(e.tacklerId);
          if (t) {
            r.teams[t].tackles++;
            if (e.success) r.teams[t].tacklesWon++;
          }
          break;
        }
        case "PASS": {
          const t = teamOf(e.fromId);
          if (t) r.teams[t].passes++;
          break;
        }
        default:
          break;
      }
    }
  }
  r.finished = sim.state.match.phase === "FINISHED";
  r.winner = sim.state.match.winner;
  r.clock = sim.state.match.clock;
  return r;
}

interface Aggregate {
  matches: number;
  finished: number;
  winsA: number;
  winsB: number;
  draws: number;
  goals: number;
  goalsA: number;
  goalsB: number;
  possA: number;
  possB: number;
  firstScorerWins: number;
  decided: number;
  kickoffGoals: number;
  counterGoals: number;
  shotsA: number;
  shotsB: number;
  shotDistA: number;
  shotDistB: number;
  tacklesA: number;
  tacklesWonA: number;
  tacklesB: number;
  tacklesWonB: number;
  passes: number;
  clock: number;
}

function aggregate(results: MatchResult[]): Aggregate {
  const a: Aggregate = {
    matches: results.length,
    finished: 0,
    winsA: 0,
    winsB: 0,
    draws: 0,
    goals: 0,
    goalsA: 0,
    goalsB: 0,
    possA: 0,
    possB: 0,
    firstScorerWins: 0,
    decided: 0,
    kickoffGoals: 0,
    counterGoals: 0,
    shotsA: 0,
    shotsB: 0,
    shotDistA: 0,
    shotDistB: 0,
    tacklesA: 0,
    tacklesWonA: 0,
    tacklesB: 0,
    tacklesWonB: 0,
    passes: 0,
    clock: 0
  };
  for (const r of results) {
    if (r.finished) a.finished++;
    if (r.winner === "A") a.winsA++;
    else if (r.winner === "B") a.winsB++;
    else a.draws++;
    if (r.winner) {
      a.decided++;
      if (r.firstScorer === r.winner) a.firstScorerWins++;
    }
    a.goals += r.goals;
    a.goalsA += r.teams.A.goals;
    a.goalsB += r.teams.B.goals;
    a.possA += r.teams.A.possessionTicks;
    a.possB += r.teams.B.possessionTicks;
    a.kickoffGoals += r.kickoffGoals;
    a.counterGoals += r.counterGoals;
    a.shotsA += r.teams.A.shots;
    a.shotsB += r.teams.B.shots;
    a.shotDistA += r.teams.A.shotDistance;
    a.shotDistB += r.teams.B.shotDistance;
    a.tacklesA += r.teams.A.tackles;
    a.tacklesWonA += r.teams.A.tacklesWon;
    a.tacklesB += r.teams.B.tackles;
    a.tacklesWonB += r.teams.B.tacklesWon;
    a.passes += r.teams.A.passes + r.teams.B.passes;
    a.clock += r.clock;
  }
  return a;
}

const pct = (n: number, d: number): string => (d > 0 ? `${Math.round((100 * n) / d)}%` : "-");
const avg = (n: number, d: number): string => (d > 0 ? (n / d).toFixed(1) : "-");

const HEADER =
  "| variant | W-L-D (A-B-draw) | goals A:B | goals/min | poss A | 1st scorer wins | kickoff goals | counter goals | shots A/B | shot dist A/B | conv A/B | tackle win A/B | passes/m | avg len |";
const SEP = "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|";

function row(name: string, a: Aggregate): string {
  return [
    name,
    `${a.winsA}-${a.winsB}-${a.draws}`,
    `${a.goalsA}:${a.goalsB}`,
    avg(a.goals, a.clock / 60),
    pct(a.possA, a.possA + a.possB),
    pct(a.firstScorerWins, a.decided),
    pct(a.kickoffGoals, a.goals),
    pct(a.counterGoals, a.goals),
    `${a.shotsA}/${a.shotsB}`,
    `${avg(a.shotDistA, a.shotsA)}/${avg(a.shotDistB, a.shotsB)}`,
    `${pct(a.goalsA, a.shotsA)}/${pct(a.goalsB, a.shotsB)}`,
    `${pct(a.tacklesWonA, a.tacklesA)}/${pct(a.tacklesWonB, a.tacklesB)}`,
    (a.passes / a.matches).toFixed(0),
    `${(a.clock / a.matches).toFixed(0)}s`
  ].join(" | ");
}

describe("Balance harness — bots vs bots", () => {
  const variants: Variant[] = [
    { name: "kickoff A, order AB (legacy)", order: "AB", kickoffTeam: "A" },
    { name: "kickoff B, order AB", order: "AB", kickoffTeam: "B" },
    { name: "kickoff A, order BA", order: "BA", kickoffTeam: "A" },
    { name: "coin toss (default)", order: "AB" }
  ];

  it(
    `plays ${SEEDS} seeds per variant and reports symmetry, kickoff goals and conversion`,
    () => {
      const aggs = variants.map((v) => aggregate(seeds().map((s) => playBots(s, v))));
      const table = variants.map((v, i) => `| ${row(v.name, aggs[i]!)} |`);
      console.info(["", "BALANCE REPORT", HEADER, SEP, ...table, ""].join("\n"));

      for (const a of aggs) {
        expect(a.finished).toBe(SEEDS);
        expect(a.goals).toBeGreaterThan(0);
      }

      // Fun bar for the default rules (coin toss). Exact side symmetry is proven separately below;
      // this only guards against seed-independent drift when tuning.
      const toss = aggs[3]!;
      expect(Math.abs(toss.winsA - toss.winsB), "side balance (wins)").toBeLessThanOrEqual(10);
      for (const [team, conv] of [
        ["A", toss.goalsA / toss.shotsA],
        ["B", toss.goalsB / toss.shotsB]
      ] as const) {
        expect(conv, `shot conversion ${team}`).toBeGreaterThan(0.15);
        expect(conv, `shot conversion ${team}`).toBeLessThan(0.6);
      }
      expect(toss.kickoffGoals / toss.goals, "kickoff goals share").toBeLessThan(0.08);
    },
    180_000
  );
});

// ------------------------------------------------------------------ side symmetry

const MIRROR: Record<string, string> = { a1: "b1", a2: "b2", a3: "b3", b1: "a1", b2: "a2", b3: "a3" };

/** First field that breaks the reflection between a match and its z-mirror, or null. */
function mirrorDiff(o: SimState, m: SimState): string | null {
  const eq = (label: string, x: number, y: number): string | null =>
    Math.abs(x - y) > 1e-9 ? `${label}: ${x} vs mirrored ${y}` : null;
  for (const p of o.players) {
    const q = m.players.find((x) => x.id === MIRROR[p.id])!;
    const d =
      eq(`${p.id}.pos.x`, p.pos.x, q.pos.x) ??
      eq(`${p.id}.pos.z`, p.pos.z, -q.pos.z) ??
      eq(`${p.id}.vel.x`, p.vel.x, q.vel.x) ??
      eq(`${p.id}.vel.z`, p.vel.z, -q.vel.z) ??
      eq(`${p.id}.facing(cos)`, Math.cos(p.facing), Math.cos(q.facing)) ??
      eq(`${p.id}.facing(sin)`, Math.sin(p.facing), -Math.sin(q.facing)) ??
      eq(`${p.id}.stamina`, p.stamina, q.stamina) ??
      eq(`${p.id}.stun`, p.stun, q.stun) ??
      eq(`${p.id}.kickCooldown`, p.kickCooldown, q.kickCooldown) ??
      eq(`${p.id}.loseCooldown`, p.loseCooldown, q.loseCooldown) ??
      eq(`${p.id}.tackleCooldown`, p.tackleCooldown, q.tackleCooldown) ??
      (p.hasBall !== q.hasBall ? `${p.id}.hasBall` : null);
    if (d) return d;
  }
  const b = o.ball;
  const c = m.ball;
  const bd =
    eq("ball.pos.x", b.pos.x, c.pos.x) ??
    eq("ball.pos.y", b.pos.y, c.pos.y) ??
    eq("ball.pos.z", b.pos.z, -c.pos.z) ??
    eq("ball.vel.x", b.vel.x, c.vel.x) ??
    eq("ball.vel.y", b.vel.y, c.vel.y) ??
    eq("ball.vel.z", b.vel.z, -c.vel.z) ??
    ((b.ownerId ? MIRROR[b.ownerId] : null) !== c.ownerId ? `ball.owner ${b.ownerId} vs ${c.ownerId}` : null);
  if (bd) return bd;
  if (o.match.phase !== m.match.phase) return `phase ${o.match.phase} vs ${m.match.phase}`;
  if (o.match.score.A !== m.match.score.B || o.match.score.B !== m.match.score.A) {
    return `score ${o.match.score.A}-${o.match.score.B} vs mirrored ${m.match.score.B}-${m.match.score.A}`;
  }
  return null;
}

/**
 * Play the same seed as-is (A kicks off, A listed first) and mirrored in z (B kicks off, B listed
 * first, so random draws are consumed in the same role order). A side-neutral sim evolves as an
 * exact reflection; the first divergence names the asymmetric rule.
 */
function firstMirrorDivergence(seed: number): string | null {
  const o = new MatchSimulation({ court: DEFAULT_COURT, rules: RULES, seed, players: roster("AB"), kickoffTeam: "A" });
  const m = new MatchSimulation({ court: DEFAULT_COURT, rules: RULES, seed, players: roster("BA"), kickoffTeam: "B" });
  const ob = new BotController(seed);
  const mb = new BotController(seed);
  for (let tick = 0; tick < MAX_TICKS; tick++) {
    for (const [id, inp] of ob.computeInputs(o.state, o.dt)) o.setInput(id, inp);
    for (const [id, inp] of mb.computeInputs(m.state, m.dt)) m.setInput(id, inp);
    o.step();
    m.step();
    const d = mirrorDiff(o.state, m.state);
    if (d) return `tick ${tick} (${o.state.match.clock.toFixed(2)}s): ${d}`;
    if (o.state.match.phase === "FINISHED") break;
  }
  return null;
}

describe("Side symmetry — a mirrored match is an exact reflection", () => {
  it("has no structural bias towards either goal (4 seeds, full matches)", () => {
    for (const seed of seeds().slice(0, 4)) {
      expect(firstMirrorDivergence(seed), `seed ${seed}`).toBeNull();
    }
  }, 60_000);
});

// ------------------------------------------------------------------ kickoff exploit

/** Human exploit under test: sprint straight from kickoff, shoot once within `shootAt` metres. */
const sprintAndShoot =
  (shootAt: number, power: number) =>
  (sim: MatchSimulation): PlayerInput => {
    const me = sim.getPlayer("a1")!;
    const goalZ = sim.state.court.length / 2; // team A attacks +z
    if (me.hasBall && goalZ - me.pos.z < shootAt) {
      return { ...EMPTY_INPUT, move: { x: 0, z: 1 }, shootPower: power };
    }
    return { ...EMPTY_INPUT, move: { x: 0, z: 1 }, sprint: true };
  };

function kickoffExploitGoals(script: (sim: MatchSimulation) => PlayerInput): { scored: number; heldBall: number } {
  let scored = 0;
  let heldBall = 0;
  for (const seed of seeds()) {
    const players = roster("AB");
    players[0]!.isHuman = true;
    const sim = new MatchSimulation({ court: DEFAULT_COURT, rules: RULES, seed, players, kickoffTeam: "A" });
    const bots = new BotController(seed);
    let goal = false;
    let held = false;
    for (let tick = 0; tick < 60 * 12 && !goal; tick++) {
      for (const [id, inp] of bots.computeInputs(sim.state, sim.dt)) sim.setInput(id, inp);
      sim.setInput("a1", script(sim));
      for (const e of sim.step()) if (e.type === "GOAL" && e.team === "A") goal = true;
      if (sim.getPlayer("a1")!.hasBall) held = true;
    }
    if (goal) scored++;
    if (held) heldBall++;
  }
  return { scored, heldBall };
}

describe("Kickoff defence — straight sprint from kickoff", () => {
  const scripts = [
    { name: "shoot from 9.5 m at 0.8 power", script: sprintAndShoot(9.5, 0.8) },
    { name: "shoot from 6 m at full power", script: sprintAndShoot(6, 1) }
  ];

  it(`sprint-and-shoot rarely scores within 12 s (${SEEDS} seeds per script)`, () => {
    const lines: string[] = [];
    const results = scripts.map((s) => {
      const r = kickoffExploitGoals(s.script);
      lines.push(`KICKOFF EXPLOIT ${s.name}: ${r.scored}/${SEEDS} (${pct(r.scored, SEEDS)})`);
      return r;
    });
    console.info(["", ...lines, ""].join("\n"));
    for (const [i, r] of results.entries()) {
      expect(r.heldBall, `${scripts[i]!.name}: human receives the kickoff ball`).toBe(SEEDS);
      expect(r.scored, `${scripts[i]!.name}: goals`).toBeLessThanOrEqual(6);
    }
  });
});
