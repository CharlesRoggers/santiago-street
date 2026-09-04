import * as THREE from "three";
import type { SimPlayer } from "@ss/shared";

export const TEAM_COLORS = { A: 0xff5a1f, B: 0x2fa8ff } as const;

/**
 * PLACEHOLDER_PLAYER_MODEL. A stylised blocky figure whose parts we animate
 * procedurally (leg swing from speed, lean from acceleration, body facing).
 * It exists so movement/camera can be tuned before real characters arrive
 * (§49: running and turning are the most visible animations).
 */
export class PlayerView {
  readonly group = new THREE.Group();
  private legL: THREE.Mesh;
  private legR: THREE.Mesh;
  private armL: THREE.Mesh;
  private armR: THREE.Mesh;
  private torso: THREE.Mesh;
  private marker: THREE.Mesh;
  private ring: THREE.Mesh;
  private phase = 0;
  private lean = 0;

  constructor(player: SimPlayer, isControlled: boolean) {
    const color = TEAM_COLORS[player.team];
    const skin = new THREE.MeshStandardMaterial({ color: 0xc78f66, roughness: 0.8 });
    const shirt = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
    const shorts = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.8 });
    const shoe = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 });

    // Body proportions (metres).
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.26), shirt);
    this.torso.position.y = 1.15;
    this.torso.castShadow = true;
    this.group.add(this.torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), skin);
    head.position.y = 1.6;
    head.castShadow = true;
    this.group.add(head);

    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.145, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1b1410 }));
    hair.position.y = 1.62;
    this.group.add(hair);

    const hips = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.26), shorts);
    hips.position.y = 0.78;
    this.group.add(hips);

    const legGeo = new THREE.BoxGeometry(0.15, 0.62, 0.18);
    legGeo.translate(0, -0.31, 0);
    this.legL = new THREE.Mesh(legGeo, skin);
    this.legR = new THREE.Mesh(legGeo, skin);
    this.legL.position.set(-0.11, 0.68, 0);
    this.legR.position.set(0.11, 0.68, 0);
    this.legL.castShadow = this.legR.castShadow = true;
    for (const leg of [this.legL, this.legR]) {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.28), shoe);
      foot.position.set(0, -0.62, 0.05);
      leg.add(foot);
      this.group.add(leg);
    }

    const armGeo = new THREE.BoxGeometry(0.11, 0.5, 0.11);
    armGeo.translate(0, -0.25, 0);
    this.armL = new THREE.Mesh(armGeo, skin);
    this.armR = new THREE.Mesh(armGeo, skin);
    this.armL.position.set(-0.28, 1.4, 0);
    this.armR.position.set(0.28, 1.4, 0);
    this.group.add(this.armL, this.armR);

    // Controlled-player marker (HUD in world space, §63 "minimal player indicators").
    this.marker = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.28, 4),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    this.marker.rotation.x = Math.PI;
    this.marker.position.y = 2.05;
    this.marker.visible = isControlled;
    this.group.add(this.marker);

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.5, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.01;
    this.ring.visible = isControlled;
    this.group.add(this.ring);
  }

  setControlled(on: boolean): void {
    this.marker.visible = on;
    this.ring.visible = on;
  }

  update(p: SimPlayer, dt: number, time: number): void {
    this.group.position.set(p.pos.x, 0, p.pos.z);
    // Sim facing is atan2(z, x); three.js yaw rotates from +z... convert.
    this.group.rotation.y = -p.facing + Math.PI / 2;

    const speed = Math.hypot(p.vel.x, p.vel.z);
    // Stride frequency scales with speed; amplitude too.
    this.phase += dt * (2.2 + speed * 1.6);
    const amp = Math.min(0.9, speed * 0.13);
    const swing = Math.sin(this.phase) * amp;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.7;
    this.armR.rotation.x = swing * 0.7;

    // Forward lean with speed, bob with stride.
    const targetLean = Math.min(0.28, speed * 0.035);
    this.lean += (targetLean - this.lean) * Math.min(1, dt * 8);
    this.torso.rotation.x = this.lean;
    this.group.position.y = Math.abs(Math.sin(this.phase)) * amp * 0.04;

    // Stunned: crouch.
    const crouch = p.stun > 0 ? 0.15 : 0;
    this.torso.position.y = 1.15 - crouch;

    // Pulse the marker.
    this.marker.position.y = 2.05 + Math.sin(time * 4) * 0.05;
  }
}
