import { angleDelta, angleOf, clamp, distance, fromAngle, length, sub } from "../math/vec2";
import type { SeededRandom } from "../math/random";
import type { CourtDimensions } from "../schemas/world";
import type { SimConfig } from "./config";
import { releaseBall } from "./possession";
import { attackDirection, type PlayerInput, type SimBall, type SimEvent, type SimPlayer } from "./types";

const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Pick the teammate best aligned with the input direction (or facing). */
export function selectPassTarget(
  passer: SimPlayer,
  players: SimPlayer[],
  input: PlayerInput,
  cfg: SimConfig
): SimPlayer | null {
  if (input.passTargetId) {
    const explicit = players.find((p) => p.id === input.passTargetId && p.team === passer.team);
    if (explicit) return explicit;
  }
  const dir = length(input.move) > 0.2 ? angleOf(input.move) : passer.facing;
  let best: SimPlayer | null = null;
  let bestScore = -Infinity;
  for (const p of players) {
    if (p.id === passer.id || p.team !== passer.team) continue;
    const to = sub(p.pos, passer.pos);
    const ang = Math.abs(angleDelta(dir, angleOf(to)));
    if (ang > cfg.pass.targetCone) continue;
    // Prefer aligned, then nearer. Weighted so a well-aligned far player still wins.
    const score = -ang * 3 - length(to) * 0.08;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

export function performPass(
  passer: SimPlayer,
  ball: SimBall,
  players: SimPlayer[],
  input: PlayerInput,
  rng: SeededRandom,
  cfg: SimConfig,
  events: SimEvent[]
): void {
  const target = selectPassTarget(passer, players, input, cfg);
  let dirAngle: number;
  let dist: number;

  if (target) {
    // Lead the target: aim where they will be after the ball's travel time.
    const rawDist = distance(passer.pos, target.pos);
    const speedGuess = clamp(rawDist * cfg.pass.speedPerMetre, cfg.pass.speedMin, cfg.pass.speedMax);
    const t = rawDist / speedGuess;
    const lead = { x: target.pos.x + target.vel.x * t, z: target.pos.z + target.vel.z * t };
    dirAngle = angleOf(sub(lead, passer.pos));
    dist = distance(passer.pos, lead);
  } else {
    dirAngle = length(input.move) > 0.2 ? angleOf(input.move) : passer.facing;
    dist = 8;
  }

  const err = mix(cfg.pass.errorMin, cfg.pass.errorMax, passer.attributes.pass);
  dirAngle += rng.range(-err, err);

  let speed = clamp(dist * cfg.pass.speedPerMetre, cfg.pass.speedMin, cfg.pass.speedMax);
  let vy = 0;
  if (input.lob) {
    speed *= cfg.pass.lobSpeedMultiplier;
    vy = cfg.pass.lobVerticalSpeed;
  }

  const d = fromAngle(dirAngle);
  releaseBall(passer, ball);
  ball.vel = { x: d.x * speed, y: vy, z: d.z * speed };
  ball.lastTouchId = passer.id;
  passer.kickCooldown = cfg.possession.kickCooldown;
  passer.facing = dirAngle;
  events.push({ type: "PASS", fromId: passer.id, toId: target?.id ?? null, lob: input.lob });
}

export function performShot(
  shooter: SimPlayer,
  ball: SimBall,
  court: CourtDimensions,
  power01: number,
  input: PlayerInput,
  rng: SeededRandom,
  cfg: SimConfig,
  events: SimEvent[]
): void {
  const power = clamp(power01, 0, 1);
  const dirZ = attackDirection(shooter.team);
  const goalZ = (court.length / 2) * dirZ;

  // Placement (§21): left-stick x (relative to attack direction) moves the aim inside the goal.
  const lateral = clamp(input.move.x * dirZ, -1, 1);
  const aimX = lateral * (court.goalWidth / 2) * cfg.shot.placementRange;

  let dirAngle = angleOf({ x: aimX - shooter.pos.x, z: goalZ - shooter.pos.z });
  const err = mix(cfg.shot.errorMin, cfg.shot.errorMax, shooter.attributes.shot);
  // More power = less precision.
  dirAngle += rng.range(-err, err) * (0.6 + power * 0.8);

  const speed = mix(cfg.shot.speedMin, cfg.shot.speedMax, power) * mix(0.9, 1.1, shooter.attributes.shot);
  const lift = mix(cfg.shot.liftMin, cfg.shot.liftMax, power);
  const d = fromAngle(dirAngle);

  releaseBall(shooter, ball);
  ball.vel = { x: d.x * speed, y: speed * lift, z: d.z * speed };
  ball.lastTouchId = shooter.id;
  shooter.kickCooldown = cfg.possession.kickCooldown;
  shooter.facing = dirAngle;
  events.push({ type: "SHOT", playerId: shooter.id, power });
}
