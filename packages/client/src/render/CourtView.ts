import * as THREE from "three";
import type { CourtDimensions } from "@ss/shared";

/**
 * PLACEHOLDER_COURT (tracked in docs/production/placeholders.md).
 * Procedural street court: asphalt, painted lines, fenced walls, two goals,
 * four floodlights. Enough to read the game; not final art (§11 hierarchy).
 */
export class CourtView {
  readonly group = new THREE.Group();

  constructor(private court: CourtDimensions) {
    const { width, length, goalWidth, goalHeight, wallHeight } = court;
    const halfW = width / 2;
    const halfL = length / 2;

    // Ground beyond the court (sidewalk / neighbourhood placeholder).
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(width * 5, length * 4),
      new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    this.group.add(ground);

    // Asphalt playing surface.
    const asphalt = new THREE.Mesh(
      new THREE.PlaneGeometry(width, length),
      new THREE.MeshStandardMaterial({ color: 0x4a4f57, roughness: 0.95, metalness: 0.02 })
    );
    asphalt.rotation.x = -Math.PI / 2;
    asphalt.receiveShadow = true;
    this.group.add(asphalt);

    // Painted lines.
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xe8e2c8 });
    const line = (w: number, l: number, x: number, z: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), lineMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.005, z);
      this.group.add(m);
    };
    const lw = 0.1;
    line(width, lw, 0, halfL - lw / 2);
    line(width, lw, 0, -halfL + lw / 2);
    line(lw, length, halfW - lw / 2, 0);
    line(lw, length, -halfW + lw / 2, 0);
    line(width, lw, 0, 0);
    // Centre circle.
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.4, 2.5, 48), lineMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.005;
    this.group.add(ring);
    // Goal areas.
    const areaW = goalWidth + 4;
    const areaD = 3.5;
    for (const s of [1, -1]) {
      line(areaW, lw, 0, s * (halfL - areaD));
      line(lw, areaD, -areaW / 2, s * (halfL - areaD / 2));
      line(lw, areaD, areaW / 2, s * (halfL - areaD / 2));
    }

    // Fence walls (chain-link look: semi-transparent with a subtle grid texture).
    const fenceMat = new THREE.MeshStandardMaterial({
      color: 0x8a949c,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      roughness: 0.6,
      metalness: 0.5
    });
    const postMat = new THREE.MeshStandardMaterial({ color: 0x55606a, roughness: 0.5, metalness: 0.6 });
    const addFence = (w: number, x: number, z: number, rotY: number) => {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(w, wallHeight), fenceMat);
      f.position.set(x, wallHeight / 2, z);
      f.rotation.y = rotY;
      this.group.add(f);
    };
    addFence(length, halfW, 0, Math.PI / 2);
    addFence(length, -halfW, 0, Math.PI / 2);
    // End fences leave the goal mouth open.
    const sideW = (width - goalWidth) / 2;
    for (const s of [1, -1]) {
      addFence(sideW, -(goalWidth / 2 + sideW / 2), s * halfL, 0);
      addFence(sideW, goalWidth / 2 + sideW / 2, s * halfL, 0);
      // Above the goal.
      const top = new THREE.Mesh(new THREE.PlaneGeometry(goalWidth, wallHeight - goalHeight), fenceMat);
      top.position.set(0, goalHeight + (wallHeight - goalHeight) / 2, s * halfL);
      this.group.add(top);
    }
    // Posts every ~4 m.
    const postGeo = new THREE.CylinderGeometry(0.04, 0.04, wallHeight, 8);
    const postsAlong = Math.round(length / 4);
    for (let i = 0; i <= postsAlong; i++) {
      const z = -halfL + (i / postsAlong) * length;
      for (const x of [halfW, -halfW]) {
        const p = new THREE.Mesh(postGeo, postMat);
        p.position.set(x, wallHeight / 2, z);
        this.group.add(p);
      }
    }

    // Goals: posts, crossbar, net box behind the line.
    const goalMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.4, metalness: 0.3 });
    const netMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide
    });
    const depth = 1.0;
    for (const s of [1, -1]) {
      const zLine = s * halfL;
      const postG = new THREE.CylinderGeometry(0.06, 0.06, goalHeight, 10);
      for (const x of [-goalWidth / 2, goalWidth / 2]) {
        const p = new THREE.Mesh(postG, goalMat);
        p.position.set(x, goalHeight / 2, zLine);
        p.castShadow = true;
        this.group.add(p);
      }
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, goalWidth + 0.12, 10), goalMat);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, goalHeight, zLine);
      this.group.add(bar);
      // Net: back + sides + top.
      const back = new THREE.Mesh(new THREE.PlaneGeometry(goalWidth, goalHeight), netMat);
      back.position.set(0, goalHeight / 2, zLine + s * depth);
      this.group.add(back);
      const topNet = new THREE.Mesh(new THREE.PlaneGeometry(goalWidth, depth), netMat);
      topNet.rotation.x = -Math.PI / 2;
      topNet.position.set(0, goalHeight, zLine + (s * depth) / 2);
      this.group.add(topNet);
      for (const x of [-goalWidth / 2, goalWidth / 2]) {
        const side = new THREE.Mesh(new THREE.PlaneGeometry(depth, goalHeight), netMat);
        side.rotation.y = Math.PI / 2;
        side.position.set(x, goalHeight / 2, zLine + (s * depth) / 2);
        this.group.add(side);
      }
    }

    // Floodlights at the corners (night courts use artificial light, §43).
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.6, metalness: 0.5 });
    for (const sx of [1, -1]) {
      for (const sz of [1, -1]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 7, 10), poleMat);
        pole.position.set(sx * (halfW + 1.2), 3.5, sz * (halfL + 1.2));
        this.group.add(pole);
        const head = new THREE.Mesh(
          new THREE.BoxGeometry(0.6, 0.25, 0.4),
          new THREE.MeshStandardMaterial({ color: 0xfff2d0, emissive: 0xffe0a0, emissiveIntensity: 1.5 })
        );
        head.position.set(sx * (halfW + 1.0), 7, sz * (halfL + 1.0));
        head.lookAt(0, 0, 0);
        this.group.add(head);
      }
    }
  }

  get dimensions(): CourtDimensions {
    return this.court;
  }
}
