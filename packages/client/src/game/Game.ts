import * as THREE from "three";
import type { SimEvent } from "@ss/shared";
import { InputManager } from "../input/InputManager";
import { TouchControls } from "../input/TouchControls";
import { BallView } from "../render/BallView";
import { CourtView } from "../render/CourtView";
import { FollowCamera } from "../render/FollowCamera";
import { PlayerView } from "../render/PlayerView";
import { Hud } from "../ui/Hud";
import { t } from "../i18n";
import { LocalMatch } from "./LocalMatch";

/**
 * Game shell: fixed-step simulation (60 Hz) decoupled from rendering
 * (requestAnimationFrame at whatever the device gives). Rendering reads the
 * latest sim state; interpolation is unnecessary at 60 Hz sim but the
 * accumulator keeps the sim deterministic regardless of frame rate.
 */
export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: FollowCamera;
  private input: InputManager;
  private hud: Hud;
  private match!: LocalMatch;
  private court!: CourtView;
  private ballView!: BallView;
  private playerViews = new Map<string, PlayerView>();
  private accumulator = 0;
  private last = performance.now();
  private time = 0;
  private fpsSamples: number[] = [];
  private finished = false;

  constructor(canvas: HTMLCanvasElement, hudRoot: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.camera = new FollowCamera(window.innerWidth / window.innerHeight);
    this.hud = new Hud(hudRoot);
    this.hud.onRestart = () => this.startMatch();

    this.startMatch();
    this.input = new InputManager(this.match.sim.cfg.shot.chargeTime);
    new TouchControls(this.input, hudRoot);

    this.setupLighting();
    this.resize();
    window.addEventListener("resize", () => this.resize());
    requestAnimationFrame((t) => this.frame(t));
  }

  private startMatch(): void {
    // Tear down previous views.
    if (this.court) this.scene.remove(this.court.group);
    if (this.ballView) this.scene.remove(this.ballView.group);
    for (const v of this.playerViews.values()) this.scene.remove(v.group);
    this.playerViews.clear();

    this.match = new LocalMatch();
    this.finished = false;
    this.hud.hideResult();

    this.court = new CourtView(this.match.sim.state.court);
    this.scene.add(this.court.group);
    this.ballView = new BallView(this.match.sim.cfg.ball.radius);
    this.scene.add(this.ballView.group);
    for (const p of this.match.sim.state.players) {
      const v = new PlayerView(p, p.id === this.match.controlledId);
      this.playerViews.set(p.id, v);
      this.scene.add(v.group);
    }
  }

  private setupLighting(): void {
    // Late-afternoon Santiago light: warm sun low in the sky, cool sky fill.
    this.scene.background = new THREE.Color(0x1a2233);
    this.scene.fog = new THREE.Fog(0x1a2233, 60, 160);
    const hemi = new THREE.HemisphereLight(0x9fc0ff, 0x4a3a2a, 1.1);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffd9a8, 2.2);
    sun.position.set(-25, 30, -15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -25;
    sun.shadow.camera.right = 25;
    sun.shadow.camera.top = 25;
    sun.shadow.camera.bottom = -25;
    sun.shadow.camera.near = 5;
    sun.shadow.camera.far = 90;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);
    // Floodlight fill so night courts read (§43 artificial lighting).
    const flood = new THREE.PointLight(0xfff0d0, 40, 45, 1.6);
    flood.position.set(0, 9, 0);
    this.scene.add(flood);
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.resize(w / h);
  }

  private frame(now: number): void {
    const frameDt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.time += frameDt;
    this.fpsSamples.push(1 / Math.max(1e-3, frameDt));
    if (this.fpsSamples.length > 30) this.fpsSamples.shift();

    this.input.update(frameDt);
    if (this.input.pressed("switch") && !this.finished) {
      const prev = this.match.controlledId;
      this.match.switchPlayer();
      this.playerViews.get(prev)?.setControlled(false);
      this.playerViews.get(this.match.controlledId)?.setControlled(true);
    }

    // Fixed-step sim.
    const dt = this.match.sim.dt;
    this.accumulator += frameDt;
    let steps = 0;
    while (this.accumulator >= dt && steps < 5) {
      const input = this.input.buildPlayerInput((v) => this.camera.toCourt(v));
      const events = this.match.step(input);
      this.handleEvents(events);
      this.accumulator -= dt;
      steps++;
    }
    if (steps === 5) this.accumulator = 0; // dropped frames: don't spiral

    // Render.
    const state = this.match.sim.state;
    for (const p of state.players) this.playerViews.get(p.id)?.update(p, frameDt, this.time);
    this.ballView.update(state.ball, frameDt);
    const controlled = state.players.find((p) => p.id === this.match.controlledId);
    this.camera.update(controlled, state.ball, this.match.humanTeam, frameDt, state.court.length);
    this.renderer.render(this.scene, this.camera.camera);

    const fps = Math.round(this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length);
    this.hud.update(state, this.match.controlledId, this.input.charge, fps);

    requestAnimationFrame((t) => this.frame(t));
  }

  private handleEvents(events: SimEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case "KICKOFF":
          this.hud.showBanner(t("banner.kickoff"), 900);
          break;
        case "GOAL":
          this.hud.showBanner(e.ownGoal ? t("banner.own_goal") : t("banner.goal"), 1800);
          break;
        case "MATCH_END":
          if (!this.finished) {
            this.finished = true;
            this.hud.showBanner(t("banner.match_end"), 1500);
            window.setTimeout(() => {
              this.hud.showResult(this.match.sim.state, this.match.humanTeam, this.match.previewReward());
            }, 1200);
          }
          break;
        default:
          break;
      }
    }
  }
}
