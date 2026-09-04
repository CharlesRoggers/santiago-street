import { angleDelta, angleOf, clampLength, length, moveTowards, scale, sub, add } from "../math/vec2";
import type { SimConfig } from "./config";
import type { PlayerInput, SimPlayer } from "./types";

const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Max run speed for this player given attributes and sprint/stamina state. */
export function maxSpeed(p: SimPlayer, input: PlayerInput, cfg: SimConfig): number {
  const base = mix(cfg.movement.runSpeedMin, cfg.movement.runSpeedMax, p.attributes.speed);
  let mult = 1;
  if (input.sprint) {
    const frac = p.stamina / cfg.stamina.max;
    if (frac >= cfg.stamina.tiredThreshold) {
      mult = cfg.movement.sprintMultiplier;
    } else {
      // Linear fall-off from full sprint to exhausted sprint.
      const t = frac / cfg.stamina.tiredThreshold;
      mult = mix(cfg.stamina.exhaustedSprintMultiplier, cfg.movement.sprintMultiplier, t);
    }
  }
  if (p.hasBall) mult *= cfg.movement.dribbleSpeedFactor;
  return base * mult;
}

/**
 * Responsive third-person movement (§17): strong acceleration, even stronger
 * deceleration, and turn-rate limited facing so animation can stay believable.
 */
export function stepMovement(p: SimPlayer, input: PlayerInput, dt: number, cfg: SimConfig): void {
  const stunned = p.stun > 0;
  const wish = stunned ? { x: 0, z: 0 } : clampLength(input.move, 1);
  const wishLen = length(wish);

  const target = scale(wish, maxSpeed(p, input, cfg));
  const accel =
    wishLen > 0.05
      ? mix(cfg.movement.accelMin, cfg.movement.accelMax, p.attributes.acceleration)
      : cfg.movement.decel;

  const delta = sub(target, p.vel);
  const step = clampLength(delta, accel * dt);
  p.vel = add(p.vel, step);
  if (length(p.vel) < 0.02 && wishLen < 0.05) p.vel = { x: 0, z: 0 };

  p.pos = add(p.pos, scale(p.vel, dt));

  // Facing follows movement intent; when idle keep last facing.
  if (wishLen > 0.05) {
    const desired = angleOf(wish);
    p.facing += Math.sign(angleDelta(p.facing, desired)) *
      Math.min(Math.abs(angleDelta(p.facing, desired)), cfg.movement.turnRate * dt);
  }

  // Stamina (§24).
  const sprinting = input.sprint && wishLen > 0.05 && !stunned;
  if (sprinting) {
    p.stamina = Math.max(0, p.stamina - cfg.stamina.sprintDrainPerSec * dt);
    p.sinceSprint = 0;
  } else {
    p.sinceSprint += dt;
    if (p.sinceSprint >= cfg.stamina.regenDelay) {
      p.stamina = Math.min(cfg.stamina.max, p.stamina + cfg.stamina.regenPerSec * dt);
    }
  }

  // Timers.
  p.stun = Math.max(0, p.stun - dt);
  p.kickCooldown = Math.max(0, p.kickCooldown - dt);
  p.loseCooldown = Math.max(0, p.loseCooldown - dt);
  p.tackleCooldown = moveTowards(p.tackleCooldown, 0, dt);
}

/** Keep players inside the court and push overlapping players apart (§23, no ragdoll). */
export function resolvePlayerCollisions(
  players: SimPlayer[],
  halfW: number,
  halfL: number,
  cfg: SimConfig
): void {
  const r = cfg.movement.radius;
  for (const p of players) {
    p.pos.x = Math.min(halfW - r, Math.max(-halfW + r, p.pos.x));
    p.pos.z = Math.min(halfL - r, Math.max(-halfL + r, p.pos.z));
  }
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i]!;
      const b = players[j]!;
      const d = sub(b.pos, a.pos);
      const dist = length(d);
      const minDist = r * 2;
      if (dist > 1e-6 && dist < minDist) {
        const push = scale(d, ((minDist - dist) / dist) * 0.5);
        // Heavier (more "physical") players move less.
        const wa = 1 - a.attributes.physical * 0.5;
        const wb = 1 - b.attributes.physical * 0.5;
        const total = wa + wb;
        a.pos = sub(a.pos, scale(push, (2 * wa) / total));
        b.pos = add(b.pos, scale(push, (2 * wb) / total));
      }
    }
  }
}
