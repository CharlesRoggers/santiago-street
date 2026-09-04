/**
 * Minimal 2D vector helpers for the gameplay simulation.
 *
 * The football simulation runs on a 2D ground plane (x = width of court,
 * z = length of court) plus a separate vertical `y` for the ball only.
 * Keeping the sim in 2D+height makes it cheap, deterministic and easy to
 * run identically on client and server (see ADR-002).
 */
export interface Vec2 {
  x: number;
  z: number;
}

export const vec2 = (x = 0, z = 0): Vec2 => ({ x, z });

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, z: a.z + b.z });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, z: a.z - b.z });
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, z: a.z * s });
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.z * b.z;
export const length = (a: Vec2): number => Math.hypot(a.x, a.z);
export const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z);

export const normalize = (a: Vec2): Vec2 => {
  const len = length(a);
  return len > 1e-9 ? { x: a.x / len, z: a.z / len } : { x: 0, z: 0 };
};

export const clampLength = (a: Vec2, max: number): Vec2 => {
  const len = length(a);
  return len > max ? scale(a, max / len) : { ...a };
};

export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: a.x + (b.x - a.x) * t,
  z: a.z + (b.z - a.z) * t
});

export const fromAngle = (rad: number): Vec2 => ({ x: Math.cos(rad), z: Math.sin(rad) });
export const angleOf = (a: Vec2): number => Math.atan2(a.z, a.x);

/** Shortest signed angle from `from` to `to`, in radians (-PI..PI]. */
export const angleDelta = (from: number, to: number): number => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
};

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

/** Move `current` towards `target` by at most `maxDelta`. */
export const moveTowards = (current: number, target: number, maxDelta: number): number => {
  const diff = target - current;
  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
};
