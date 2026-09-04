import { describe, expect, it } from "vitest";
import type { MatchRules } from "../schemas/events";
import { BotController } from "./ai";
import { DEFAULT_COURT, MatchSimulation, type MatchSetup, type PlayerSpec } from "./match";
import { EMPTY_INPUT, type PlayerInput, type TeamId } from "./types";

/**
 * Balance harness (§150 quality bar, §153 honest status).
 *
 * The owner's machine cannot run the game, so the CI log is the playtest notebook:
 * bots-vs-bots matches over many seeds, printed as one table row per variant —
 * side symmetry, kickoff exploitability, shot conversion, tackle rates.
 * Everything is seeded, so a number that moves was moved by code.
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

interface TeamStats {
  goals: number;
  shots: number;
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
  // PLAYING time plus every possible kickoff countdown and goal celebration.
  const maxTicks = (RULES.durationSec + 60) * 60;

  for (let tick = 0; tick < maxTicks && sim.state.match.phase !== "FINISHED"; tick++) {
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
          const t = teamOf(e.playerId);
          if (t) r.teams[t].shots++;
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

const HEADER =
  "| variant | W-L-D (A-B-draw) | goals A:B | poss A | 1st scorer wins | kickoff goals | counter goals | conv A/B | tackle win A/B | passes/m | avg len |";
const SEP = "|---|---|---|---|---|---|---|---|---|---|---|";

function row(name: string, a: Aggregate): string {
  return [
    name,
    `${a.winsA}-${a.winsB}-${a.draws}`,
    `${a.goalsA}:${a.goalsB}`,
    pct(a.possA, a.possA + a.possB),
    pct(a.firstScorerWins, a.decided),
    pct(a.kickoffGoals, a.goals),
    pct(a.counterGoals, a.goals),
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
    },
    180_000
  );
});

/** Human exploit under test: sprint straight from kickoff, shoot once in range. */
const sprintAndShoot = (sim: MatchSimulation): PlayerInput => {
  const me = sim.getPlayer("a1")!;
  const goalZ = sim.state.court.length / 2; // team A attacks +z
  if (me.hasBall && goalZ - me.pos.z < 9.5) {
    return { ...EMPTY_INPUT, move: { x: 0, z: 1 }, shootPower: 0.8 };
  }
  return { ...EMPTY_INPUT, move: { x: 0, z: 1 }, sprint: true };
};

describe("Kickoff defence — straight sprint from kickoff", () => {
  it(`measures how often sprint-and-shoot scores within 12 s over ${SEEDS} seeds`, () => {
    let scored = 0;
    let heldBall = 0;
    for (const seed of seeds()) {
      const players = roster("AB");
      players[0]!.isHuman = true;
      const sim = new MatchSimulation({
        court: DEFAULT_COURT,
        rules: RULES,
        seed,
        players,
        kickoffTeam: "A"
      });
      const bots = new BotController(seed);
      let goal = false;
      let held = false;
      for (let tick = 0; tick < 60 * 12 && !goal; tick++) {
        for (const [id, inp] of bots.computeInputs(sim.state, sim.dt)) sim.setInput(id, inp);
        sim.setInput("a1", sprintAndShoot(sim));
        for (const e of sim.step()) if (e.type === "GOAL" && e.team === "A") goal = true;
        if (sim.getPlayer("a1")!.hasBall) held = true;
      }
      if (goal) scored++;
      if (held) heldBall++;
    }
    console.info(`\nKICKOFF EXPLOIT: sprint-and-shoot scored ${scored}/${SEEDS} (${pct(scored, SEEDS)})\n`);
    expect(heldBall).toBe(SEEDS); // the human always receives the kickoff ball
  });
});
