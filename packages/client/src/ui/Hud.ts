import type { Reward, SimState, TeamId } from "@ss/shared";
import { t } from "../i18n";

/**
 * Minimal football HUD (§63): score, timer, stamina, shot charge, banners,
 * and a result panel. All strings go through i18n (§86).
 */
export class Hud {
  private scoreA: HTMLElement;
  private scoreB: HTMLElement;
  private clock: HTMLElement;
  private stamina: HTMLElement;
  private staminaWrap: HTMLElement;
  private charge: HTMLElement;
  private chargeWrap: HTMLElement;
  private banner: HTMLElement;
  private result: HTMLElement;
  private status: HTMLElement;
  private bannerTimer: number | null = null;
  onRestart: (() => void) | null = null;

  constructor(root: HTMLElement) {
    root.innerHTML = `
      <div class="scoreboard">
        <div class="team"><span class="dot A"></span><span data-a>0</span></div>
        <div class="clock" data-clock>0:00</div>
        <div class="team"><span data-b>0</span><span class="dot B"></span></div>
      </div>
      <div class="status" data-status></div>
      <div class="charge" data-charge-wrap><div data-charge style="width:0%"></div></div>
      <div class="stamina" data-stamina-wrap><div data-stamina style="width:100%"></div></div>
      <div class="banner" data-banner></div>
      <div class="hint" data-hint>
        <kbd>WASD</kbd> ${t("hud.move")} · <kbd>Shift</kbd> ${t("hud.sprint")} · <kbd>Space</kbd> ${t("hud.pass")} · <kbd>Q</kbd> ${t("hud.lob")}<br>
        <kbd>K</kbd> ${t("hud.shoot_hold")} · <kbd>L</kbd> ${t("hud.tackle")} · <kbd>Tab</kbd> ${t("hud.switch")}
      </div>
      <div class="result" data-result>
        <div class="card">
          <h1 data-result-title></h1>
          <div class="score" data-result-score></div>
          <div class="rewards">
            <div><b data-r-xp>0</b><span>XP</span></div>
            <div><b data-r-money>0</b><span>${t("hud.money")}</span></div>
            <div><b data-r-rep>0</b><span>${t("hud.reputation")}</span></div>
          </div>
          <div class="note">${t("hud.offline_note")}</div>
          <button data-restart>${t("hud.play_again")}</button>
        </div>
      </div>`;
    const q = <T extends HTMLElement>(sel: string): T => root.querySelector(sel) as T;
    this.scoreA = q("[data-a]");
    this.scoreB = q("[data-b]");
    this.clock = q("[data-clock]");
    this.stamina = q("[data-stamina]");
    this.staminaWrap = q("[data-stamina-wrap]");
    this.charge = q("[data-charge]");
    this.chargeWrap = q("[data-charge-wrap]");
    this.banner = q("[data-banner]");
    this.result = q("[data-result]");
    this.status = q("[data-status]");
    q("[data-restart]").addEventListener("click", () => this.onRestart?.());
    if (matchMedia("(pointer: coarse)").matches) q("[data-hint]").style.display = "none";
  }

  update(state: SimState, controlledId: string | null, charge: number, fps: number): void {
    this.scoreA.textContent = String(state.match.score.A);
    this.scoreB.textContent = String(state.match.score.B);
    const remaining = Math.max(0, state.rules.durationSec - state.match.clock);
    const m = Math.floor(remaining / 60);
    const s = Math.floor(remaining % 60);
    this.clock.textContent = `${m}:${s.toString().padStart(2, "0")}`;

    const p = controlledId ? state.players.find((x) => x.id === controlledId) : undefined;
    if (p) {
      const frac = p.stamina / 100;
      this.stamina.style.width = `${Math.round(frac * 100)}%`;
      this.staminaWrap.classList.toggle("low", frac < 0.3);
    }
    this.chargeWrap.classList.toggle("on", charge > 0);
    this.charge.style.width = `${Math.round(charge * 100)}%`;
    this.status.innerHTML = `${fps} fps <span class="tag">${t("status.offline")}</span><span class="tag">${t("status.prototype")}</span>`;
  }

  showBanner(text: string, ms = 1600): void {
    this.banner.textContent = text;
    this.banner.classList.add("show");
    if (this.bannerTimer) window.clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.banner.classList.remove("show"), ms);
  }

  showResult(state: SimState, humanTeam: TeamId, reward: Reward): void {
    const root = this.result;
    const title = root.querySelector("[data-result-title]") as HTMLElement;
    const w = state.match.winner;
    title.textContent = w === null ? t("result.draw") : w === humanTeam ? t("result.win") : t("result.loss");
    (root.querySelector("[data-result-score]") as HTMLElement).textContent = `${state.match.score.A} – ${state.match.score.B}`;
    (root.querySelector("[data-r-xp]") as HTMLElement).textContent = `+${reward.xp}`;
    (root.querySelector("[data-r-money]") as HTMLElement).textContent = `+${reward.money}`;
    (root.querySelector("[data-r-rep]") as HTMLElement).textContent = `+${reward.reputation}`;
    root.classList.add("show");
  }

  hideResult(): void {
    this.result.classList.remove("show");
  }
}
