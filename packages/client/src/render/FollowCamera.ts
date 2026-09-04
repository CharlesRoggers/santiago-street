import * as THREE from "three";
import type { SimBall, SimPlayer, TeamId } from "@ss/shared";

/**
 * Dynamic tactical third-person camera (§47). Sits behind the controlled
 * team's own goal side, elevated, and frames a weighted point between the
 * controlled player and the ball. Distance grows with player–ball separation
 * so both stay on screen. No collisions needed yet: the court is open air.
 */
export class FollowCamera {
  readonly camera: THREE.PerspectiveCamera;
  private target = new THREE.Vector3();
  private position = new THREE.Vector3();
  private initialized = false;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 400);
  }

  /** Yaw (radians, sim convention atan2(z,x)) of the camera's forward direction on the ground. */
  get yaw(): number {
    const f = new THREE.Vector3();
    this.camera.getWorldDirection(f);
    return Math.atan2(f.z, f.x);
  }

  /** Convert screen-space input (x right, y up/forward) to court space using camera yaw. */
  toCourt(v: { x: number; y: number }): { x: number; z: number } {
    const yaw = this.yaw;
    const fx = Math.cos(yaw);
    const fz = Math.sin(yaw);
    // Right vector = forward rotated -90° around Y (in x/z plane).
    const rx = -fz;
    const rz = fx;
    return { x: fx * v.y + rx * v.x, z: fz * v.y + rz * v.x };
  }

  update(player: SimPlayer | undefined, ball: SimBall, team: TeamId, dt: number, courtLength: number): void {
    const dir = team === "A" ? 1 : -1; // team A attacks +z, so camera sits at -z looking +z
    const px = player?.pos.x ?? 0;
    const pz = player?.pos.z ?? 0;

    // Frame point: 60% player, 40% ball.
    const fx = px * 0.6 + ball.pos.x * 0.4;
    const fz = pz * 0.6 + ball.pos.z * 0.4;
    const sep = Math.hypot(px - ball.pos.x, pz - ball.pos.z);

    const back = 11 + Math.min(8, sep * 0.5);
    const height = 7 + Math.min(4, sep * 0.3);
    const desired = new THREE.Vector3(fx * 0.85, height, fz - dir * back);
    // Keep the camera outside the far end so the goal is never behind us.
    const limit = courtLength / 2 + 8;
    desired.z = dir > 0 ? Math.max(-limit, desired.z) : Math.min(limit, desired.z);
    const desiredTarget = new THREE.Vector3(fx, 0.8, fz + dir * 2);

    if (!this.initialized) {
      this.position.copy(desired);
      this.target.copy(desiredTarget);
      this.initialized = true;
    } else {
      const k = 1 - Math.exp(-dt * 6);
      this.position.lerp(desired, k);
      this.target.lerp(desiredTarget, 1 - Math.exp(-dt * 8));
    }
    this.camera.position.copy(this.position);
    this.camera.lookAt(this.target);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    // Portrait phones need a wider FOV to keep the court readable.
    this.camera.fov = aspect < 1 ? 70 : 50;
    this.camera.updateProjectionMatrix();
  }
}
