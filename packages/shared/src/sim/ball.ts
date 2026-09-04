import type { CourtDimensions } from "../schemas/world";
import type { SimConfig } from "./config";
import type { SimBall, SimEvent, TeamId } from "./types";

export interface BallStepResult {
  /** Team credited with the goal (the team whose attacking goal was crossed). */
  goalFor: TeamId | null;
}

/**
 * Independent ball physics (§18). Runs only while the ball is loose; while
 * controlled, possession.ts drives the ball.
 *
 * Court walls: street courts are fenced, so the ball bounces off side/end
 * walls up to `wallHeight`. The only openings are the goals.
 */
export function stepLooseBall(
  ball: SimBall,
  court: CourtDimensions,
  dt: number,
  cfg: SimConfig,
  events: SimEvent[]
): BallStepResult {
  const b = cfg.ball;
  const halfW = court.width / 2;
  const halfL = court.length / 2;
  const r = b.radius;

  // Gravity + drag.
  ball.vel.y -= b.gravity * dt;
  const onGround = ball.pos.y <= r + 1e-4 && Math.abs(ball.vel.y) < b.bounceStopSpeed;

  if (onGround) {
    ball.pos.y = r;
    ball.vel.y = 0;
    // Rolling friction.
    const speed = Math.hypot(ball.vel.x, ball.vel.z);
    if (speed > 0) {
      const ns = Math.max(0, speed - b.rollingFriction * dt);
      const k = ns / speed;
      ball.vel.x *= k;
      ball.vel.z *= k;
    }
  } else {
    const drag = Math.max(0, 1 - b.airDrag * dt);
    ball.vel.x *= drag;
    ball.vel.z *= drag;
  }

  // Clamp speed.
  const sp = Math.hypot(ball.vel.x, ball.vel.y, ball.vel.z);
  if (sp > b.maxSpeed) {
    const k = b.maxSpeed / sp;
    ball.vel.x *= k;
    ball.vel.y *= k;
    ball.vel.z *= k;
  }

  // Integrate.
  ball.pos.x += ball.vel.x * dt;
  ball.pos.y += ball.vel.y * dt;
  ball.pos.z += ball.vel.z * dt;

  // Ground bounce.
  if (ball.pos.y < r) {
    ball.pos.y = r;
    if (ball.vel.y < -b.bounceStopSpeed) {
      ball.vel.y = -ball.vel.y * b.groundBounce;
      events.push({ type: "BALL_BOUNCE", speed: Math.abs(ball.vel.y) });
    } else {
      ball.vel.y = 0;
    }
  }

  // Side walls.
  if (ball.pos.x - r < -halfW && ball.vel.x < 0) {
    ball.pos.x = -halfW + r;
    ball.vel.x = -ball.vel.x * b.wallBounce;
    events.push({ type: "BALL_WALL", speed: Math.abs(ball.vel.x) });
  } else if (ball.pos.x + r > halfW && ball.vel.x > 0) {
    ball.pos.x = halfW - r;
    ball.vel.x = -ball.vel.x * b.wallBounce;
    events.push({ type: "BALL_WALL", speed: Math.abs(ball.vel.x) });
  }

  // End walls & goals. Team A attacks +z, so a ball crossing +z inside the goal is a goal for A.
  const inGoalMouth = Math.abs(ball.pos.x) < court.goalWidth / 2 && ball.pos.y < court.goalHeight;
  let goalFor: TeamId | null = null;

  if (ball.pos.z + r > halfL) {
    if (inGoalMouth && ball.vel.z > 0) {
      goalFor = "A";
    } else if (ball.vel.z > 0) {
      ball.pos.z = halfL - r;
      ball.vel.z = -ball.vel.z * b.wallBounce;
      events.push({ type: "BALL_WALL", speed: Math.abs(ball.vel.z) });
    }
  } else if (ball.pos.z - r < -halfL) {
    if (inGoalMouth && ball.vel.z < 0) {
      goalFor = "B";
    } else if (ball.vel.z < 0) {
      ball.pos.z = -halfL + r;
      ball.vel.z = -ball.vel.z * b.wallBounce;
      events.push({ type: "BALL_WALL", speed: Math.abs(ball.vel.z) });
    }
  }

  return { goalFor };
}

export function resetBall(ball: SimBall, cfg: SimConfig): void {
  ball.pos = { x: 0, y: cfg.ball.radius, z: 0 };
  ball.vel = { x: 0, y: 0, z: 0 };
  ball.ownerId = null;
  ball.lastTouchId = null;
  ball.assistCandidateId = null;
}
