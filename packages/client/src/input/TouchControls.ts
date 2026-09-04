import type { Action, InputManager } from "./InputManager";

/**
 * On-screen controls for phones/tablets (Android PWA target, ADR-000).
 * Left half: floating joystick (appears where the thumb lands).
 * Right side: action buttons. Buttons are large (≥ 64px) for thumbs.
 */
export class TouchControls {
  private root: HTMLDivElement;
  private stickBase: HTMLDivElement;
  private stickKnob: HTMLDivElement;
  private stickTouchId: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private readonly radius = 56;

  constructor(private input: InputManager, parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "touch-controls";
    parent.appendChild(this.root);

    this.stickBase = document.createElement("div");
    this.stickBase.className = "stick-base";
    this.stickKnob = document.createElement("div");
    this.stickKnob.className = "stick-knob";
    this.stickBase.appendChild(this.stickKnob);
    this.root.appendChild(this.stickBase);
    this.stickBase.style.display = "none";

    const buttons: Array<{ action: Action; label: string; cls: string }> = [
      { action: "shoot", label: "TIRO", cls: "btn-shoot" },
      { action: "pass", label: "PASE", cls: "btn-pass" },
      { action: "tackle", label: "QUITE", cls: "btn-tackle" },
      { action: "lob", label: "GLOBO", cls: "btn-lob" },
      { action: "sprint", label: "SPRINT", cls: "btn-sprint" },
      { action: "switch", label: "CAMBIO", cls: "btn-switch" }
    ];
    const group = document.createElement("div");
    group.className = "touch-buttons";
    for (const b of buttons) {
      const el = document.createElement("button");
      el.className = `touch-btn ${b.cls}`;
      el.textContent = b.label;
      el.setAttribute("aria-label", b.label);
      const press = (e: Event) => {
        e.preventDefault();
        this.input.usingTouch = true;
        this.input.touchActions.add(b.action);
        el.classList.add("active");
      };
      const release = (e: Event) => {
        e.preventDefault();
        this.input.touchActions.delete(b.action);
        el.classList.remove("active");
      };
      el.addEventListener("pointerdown", press);
      el.addEventListener("pointerup", release);
      el.addEventListener("pointercancel", release);
      el.addEventListener("pointerleave", release);
      group.appendChild(el);
    }
    this.root.appendChild(group);

    // Joystick on the left half of the screen.
    const zone = document.createElement("div");
    zone.className = "stick-zone";
    this.root.appendChild(zone);
    zone.addEventListener("touchstart", (e) => this.onStickStart(e), { passive: false });
    zone.addEventListener("touchmove", (e) => this.onStickMove(e), { passive: false });
    zone.addEventListener("touchend", (e) => this.onStickEnd(e), { passive: false });
    zone.addEventListener("touchcancel", (e) => this.onStickEnd(e), { passive: false });

    // Only show on touch devices.
    const isTouch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
    this.root.style.display = isTouch ? "block" : "none";
  }

  private onStickStart(e: TouchEvent): void {
    e.preventDefault();
    if (this.stickTouchId !== null) return;
    const t = e.changedTouches[0];
    if (!t) return;
    this.input.usingTouch = true;
    this.stickTouchId = t.identifier;
    this.stickOrigin = { x: t.clientX, y: t.clientY };
    this.stickBase.style.display = "block";
    this.stickBase.style.left = `${t.clientX - this.radius}px`;
    this.stickBase.style.top = `${t.clientY - this.radius}px`;
    this.setKnob(0, 0);
  }

  private onStickMove(e: TouchEvent): void {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== this.stickTouchId) continue;
      let dx = t.clientX - this.stickOrigin.x;
      let dy = t.clientY - this.stickOrigin.y;
      const len = Math.hypot(dx, dy);
      if (len > this.radius) {
        dx = (dx / len) * this.radius;
        dy = (dy / len) * this.radius;
      }
      this.setKnob(dx, dy);
      this.input.touchMove = { x: dx / this.radius, y: -dy / this.radius };
    }
  }

  private onStickEnd(e: TouchEvent): void {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== this.stickTouchId) continue;
      this.stickTouchId = null;
      this.input.touchMove = { x: 0, y: 0 };
      this.stickBase.style.display = "none";
    }
  }

  private setKnob(dx: number, dy: number): void {
    this.stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  }
}
