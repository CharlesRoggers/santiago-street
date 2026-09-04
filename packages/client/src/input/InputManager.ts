import type { PlayerInput } from "@ss/shared";
import { clamp } from "@ss/shared";

/**
 * Unified input (§80–§81): keyboard, gamepad and touch all feed the same
 * action state. Movement is in CAMERA space (up = away from camera); the game
 * converts it to court space using the camera yaw.
 *
 * Bindings are data (remappable later via settings).
 */
export type Action = "sprint" | "pass" | "lob" | "shoot" | "tackle" | "switch" | "pause";

export const KEY_BINDINGS: Record<string, Action> = {
  ShiftLeft: "sprint",
  ShiftRight: "sprint",
  Space: "pass",
  KeyJ: "pass",
  KeyQ: "lob",
  KeyU: "lob",
  KeyK: "shoot",
  Enter: "shoot",
  KeyL: "tackle",
  KeyE: "tackle",
  Tab: "switch",
  KeyI: "switch",
  Escape: "pause"
};

/** Standard gamepad mapping (Xbox layout indices). */
export const PAD_BINDINGS: Record<number, Action> = {
  0: "pass", // A
  1: "shoot", // B
  2: "lob", // X
  3: "tackle", // Y
  4: "switch", // LB
  5: "sprint", // RB
  7: "sprint", // RT
  9: "pause" // Start
};

interface ActionState {
  down: boolean;
  pressed: boolean; // rising edge this frame
  released: boolean; // falling edge this frame
  heldFor: number;
}

export class InputManager {
  private keys = new Set<string>();
  private actions: Record<Action, ActionState> = {
    sprint: mk(),
    pass: mk(),
    lob: mk(),
    shoot: mk(),
    tackle: mk(),
    switch: mk(),
    pause: mk()
  };
  private prevDown: Record<Action, boolean> = {
    sprint: false,
    pass: false,
    lob: false,
    shoot: false,
    tackle: false,
    switch: false,
    pause: false
  };

  /** Touch joystick vector in screen space (-1..1). */
  touchMove = { x: 0, y: 0 };
  touchActions = new Set<Action>();
  /** Set by the touch layer when user is using touch (hides keyboard hints). */
  usingTouch = false;
  private shotCharge = 0;
  private readonly shotChargeTime: number;

  constructor(shotChargeTime: number) {
    this.shotChargeTime = shotChargeTime;
    window.addEventListener("keydown", (e) => {
      if (e.code in KEY_BINDINGS || e.code.startsWith("Arrow") || ["KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)) {
        e.preventDefault();
      }
      this.keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());
  }

  /** Call once per rendered frame with the frame delta (seconds). */
  update(dt: number): void {
    const pad = this.readGamepad();
    for (const action of Object.keys(this.actions) as Action[]) {
      const down =
        this.keyDown(action) || (pad?.buttons[action] ?? false) || this.touchActions.has(action);
      const st = this.actions[action];
      st.pressed = down && !this.prevDown[action];
      st.released = !down && this.prevDown[action];
      st.down = down;
      st.heldFor = down ? st.heldFor + dt : 0;
      this.prevDown[action] = down;
    }
    if (this.actions.shoot.down) this.shotCharge = Math.min(1, this.shotCharge + dt / this.shotChargeTime);

    this.moveVec = this.computeMove(pad);
  }

  private moveVec = { x: 0, y: 0 };

  /** Screen-space movement: x right, y up (towards the far side of the screen). */
  get move(): { x: number; y: number } {
    return this.moveVec;
  }

  /** Current shot charge 0..1 while the shoot button is held. */
  get charge(): number {
    return this.actions.shoot.down ? this.shotCharge : 0;
  }

  pressed(a: Action): boolean {
    return this.actions[a].pressed;
  }
  down(a: Action): boolean {
    return this.actions[a].down;
  }

  /**
   * Build the sim input for this tick. `toCourt` converts a screen-space vector
   * into court space using the current camera orientation.
   */
  buildPlayerInput(toCourt: (v: { x: number; y: number }) => { x: number; z: number }): PlayerInput {
    const move = toCourt(this.moveVec);
    const input: PlayerInput = {
      move,
      sprint: this.actions.sprint.down,
      pass: this.actions.pass.pressed,
      lob: this.actions.lob.pressed,
      tackle: this.actions.tackle.pressed
    };
    if (this.actions.shoot.released) {
      input.shootPower = Math.max(0.2, this.shotCharge);
      this.shotCharge = 0;
    }
    return input;
  }

  // ----------------------------------------------------------------- private

  private keyDown(action: Action): boolean {
    for (const [code, a] of Object.entries(KEY_BINDINGS)) if (a === action && this.keys.has(code)) return true;
    return false;
  }

  private computeMove(pad: PadState | null): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) x -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) x += 1;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) y += 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) y -= 1;
    if (pad && Math.hypot(pad.axes.x, pad.axes.y) > 0.15) {
      x = pad.axes.x;
      y = -pad.axes.y;
    }
    if (Math.hypot(this.touchMove.x, this.touchMove.y) > 0.1) {
      x = this.touchMove.x;
      y = this.touchMove.y;
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
  }

  private readGamepad(): PadState | null {
    const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = Array.from(pads).find((p) => p && p.connected);
    if (!gp) return null;
    const buttons: Partial<Record<Action, boolean>> = {};
    gp.buttons.forEach((b, i) => {
      const a = PAD_BINDINGS[i];
      if (a) buttons[a] = buttons[a] || b.pressed || b.value > 0.5;
    });
    return { axes: { x: gp.axes[0] ?? 0, y: gp.axes[1] ?? 0 }, buttons };
  }
}

interface PadState {
  axes: { x: number; y: number };
  buttons: Partial<Record<Action, boolean>>;
}

const mk = (): ActionState => ({ down: false, pressed: false, released: false, heldFor: 0 });
