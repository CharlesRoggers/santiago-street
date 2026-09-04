import * as THREE from "three";
import type { SimBall } from "@ss/shared";

/** PLACEHOLDER_BALL: two-tone sphere so spin is readable. */
export class BallView {
  readonly group = new THREE.Group();
  private mesh: THREE.Mesh;
  private shadow: THREE.Mesh;

  constructor(radius: number) {
    const geo = new THREE.SphereGeometry(radius, 24, 16);
    // Simple checker via vertex colors.
    const colors: number[] = [];
    const pos = geo.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const x = pos.getX(i);
      const dark = Math.sin(x * 40) * Math.sin(y * 40) > 0;
      colors.push(dark ? 0.12 : 0.95, dark ? 0.12 : 0.95, dark ? 0.12 : 0.95);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    this.mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }));
    this.mesh.castShadow = true;
    this.group.add(this.mesh);

    // Blob shadow keeps height readable even where real shadows are cheap/absent.
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 1.2, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.006;
    this.group.add(this.shadow);
  }

  update(ball: SimBall, dt: number): void {
    this.mesh.position.set(ball.pos.x, ball.pos.y, ball.pos.z);
    this.shadow.position.x = ball.pos.x;
    this.shadow.position.z = ball.pos.z;
    const h = Math.max(0, ball.pos.y - 0.11);
    const s = 1 + h * 0.6;
    this.shadow.scale.set(s, s, s);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.08, 0.35 - h * 0.08);

    // Roll: angular velocity = v / r around the axis perpendicular to travel.
    const speed = Math.hypot(ball.vel.x, ball.vel.z);
    if (speed > 0.01) {
      const axis = new THREE.Vector3(ball.vel.z, 0, -ball.vel.x).normalize();
      this.mesh.rotateOnWorldAxis(axis, (speed / 0.11) * dt);
    }
  }
}
