import { Game } from "./game/Game";
import { detectLocale, setLocale } from "./i18n";

setLocale(detectLocale());

const canvas = document.getElementById("game") as HTMLCanvasElement | null;
const hud = document.getElementById("hud");
if (!canvas || !hud) {
  throw new Error("Missing #game canvas or #hud root in index.html");
}

// Expose for the smoke test / dev console. Development only.
const game = new Game(canvas, hud);
if (import.meta.env.DEV) {
  (window as unknown as { __ss: unknown }).__ss = game;
}
