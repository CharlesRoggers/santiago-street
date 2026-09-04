import { distance, fromAngle } from "../math/vec2";
import type { SeededRandom } from "../math/random";
import type { SimConfig } from "./config";
import type { PlayerInput, SimBall, SimEvent, SimPlayer } from "./types";

const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Possession model (§19). The ball is never glued to a foot: while controlled
 * it chases a point in front of the player with finite follow speed, so fast
 * turns visibly "carry" the ball and it can be poked away.
 */
export function stepControlledBall(owner: SimPlayer, ball: SimBall, dt: number, cfg: SimConfig): void {
  const f = fromAngle(owner.facing);
  const targetX = owner.pos.x + f.x * cfg.possession.dribbleOffset;
  const targetZ = owner.pos.z + f.z * cfg.possession.dribbleOffset;
  // Better control = tighter follow.
  const follow = cfg.possession.dribbleFollow * mix(0.7, 1.3, owner.attributes.control);
  const k = Math.min(1, follow * dt);
  const nx = ball.pos.x + (targetX - ball.pos.x) * k;
  const nz = ball.pos.z + (targetZ - ball.pos.z) * k;
  ball.vel = { x: (nx - ball.pos.x) / dt, y: 0, z: (nz - ball.pos.z) / dt };
  ball.pos = { x: nx, y: cfg.ball.radius, z: nz };
}

/**
 * Try to give a loose ball to the best-placed eligible player.
 * Returns the new owner or null.
 */
export function tryGainPossession(
  players: SimPlayer[],
  ball: SimBall,
  cfg: SimConfig,
  events: SimEvent[]
): SimPlayer | null {
  if (ball.pos.y > cfg.possession.controlMaxHeight) return null;
  let best: SimPlayer | null = null;
  let bestScore = Infinity;

  for (const p of players) {
    if (p.stun > 0 || p.kickCooldown > 0 || p.loseCooldown > 0) continue;
    const d = distance(p.pos, { x: ball.pos.x, z: ball.pos.z });
    if (d > cfg.possession.controlRadius) continue;
    const relSpeed = Math.hypot(ball.vel.x - p.vel.x, ball.vel.z - p.vel.z);
    const maxRel = mix(cfg.possession.controlSpeedMin, cfg.possession.controlSpeedMax, p.attributes.control);
    if (relSpeed > maxRel) continue;
    // Prefer the closest; slight preference to better control.
    const score = d - p.attributes.control * 0.1;
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }

  if (best) {
    ball.ownerId = best.id;
    best.hasBall = true;
    if (ball.lastTouchId !== best.id) {
      ball.assistCandidateId = ball.lastTouchId;
      ball.lastTouchId = best.id;
    }
    ball.vel = { x: 0, y: 0, z: 0 };
    ball.pos.y = cfg.ball.radius;
    events.push({ type: "POSSESSION", playerId: best.id });
  }
  return best;
}

/**
 * Body blocking / deflection (§19, §23): a loose ball that reaches a player who
 * could NOT control it (too fast, cooldown, stunned) bounces off their body.
 * This is what makes standing in the lane a real defensive action.
 */
export function deflectOffPlayers(
  players: SimPlayer[],
  ball: SimBall,
  cfg: SimConfig,
  events: SimEvent[]
): void {
  if (ball.pos.y > 1.9) return; // over everyone's head
  const hitR = cfg.movement.radius + cfg.ball.radius;
  for (const p of players) {
    const dx = ball.pos.x - p.pos.x;
    const dz = ball.pos.z - p.pos.z;
    const d = Math.hypot(dx, dz);
    if (d >= hitR || d < 1e-6) continue;
    const nx = dx / d;
    const nz = dz / d;
    const approaching = ball.vel.x * nx + ball.vel.z * nz;
    // Push out of the body.
    ball.pos.x = p.pos.x + nx * hitR;
    ball.pos.z = p.pos.z + nz * hitR;
    if (approaching < 0) {
      // Reflect the normal component, damp it, and add the player's own velocity.
      const restitution = 0.45;
      ball.vel.x -= (1 + restitution) * approaching * nx;
      ball.vel.z -= (1 + restitution) * approaching * nz;
      ball.vel.x = ball.vel.x * 0.8 + p.vel.x * 0.5;
      ball.vel.z = ball.vel.z * 0.8 + p.vel.z * 0.5;
      ball.vel.y = Math.max(ball.vel.y, 0) * 0.5;
      if (ball.lastTouchId !== p.id) {
        ball.assistCandidateId = null; // a deflection breaks the assist chain
        ball.lastTouchId = p.id;
      }
      events.push({ type: "BALL_BOUNCE", speed: Math.abs(approaching) });
    }
  }
}

export function releaseBall(owner: SimPlayer, ball: SimBall): void {
  owner.hasBall = false;
  if (ball.ownerId === owner.id) ball.ownerId = null;
}

/**
 * Tackle attempt (§16/§23). Success depends on defense vs dribble and on
 * approaching from the front vs behind. Failure stuns the tackler — this is
 * what makes tackling a decision instead of a spam button.
 */
export function tryTackle(
  tackler: SimPlayer,
  owner: SimPlayer,
  ball: SimBall,
  input: PlayerInput,
  rng: SeededRandom,
  cfg: SimConfig,
  events: SimEvent[]
): void {
  if (!input.tackle || tackler.stun > 0 || tackler.tackleCooldown > 0) return;
  if (tackler.team === owner.team) return;
  const d = distance(tackler.pos, owner.pos);
  if (d > cfg.tackle.radius) return;

  tackler.tackleCooldown = cfg.tackle.cooldown;
  tackler.stamina = Math.max(0, tackler.stamina - cfg.stamina.tackleCost);

  const attrDelta = tackler.attributes.defense - owner.attributes.dribble;
  const chance = cfg.tackle.baseChance + attrDelta * cfg.tackle.attributeInfluence;
  const success = rng.chance(Math.min(0.92, Math.max(0.12, chance)));

  events.push({ type: "TACKLE", tacklerId: tackler.id, victimId: owner.id, success });

  if (success) {
    releaseBall(owner, ball);
    owner.stun = cfg.tackle.victimStun;
    owner.loseCooldown = cfg.possession.loseCooldown;
    // Knock the ball in the tackler's facing direction so it becomes a loose ball fight.
    const f = fromAngle(tackler.facing);
    ball.vel = { x: f.x * cfg.tackle.ballImpulse, y: 0.5, z: f.z * cfg.tackle.ballImpulse };
    ball.lastTouchId = tackler.id;
    tackler.kickCooldown = 0.1;
  } else {
    tackler.stun = cfg.tackle.failStun;
  }
}
