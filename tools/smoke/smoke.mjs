/**
 * Smoke test: serve the built client, load it in headless Chromium, play for a
 * few seconds with synthetic keyboard input, assert no console errors, and
 * save screenshots (desktop + phone landscape). Run: `node tools/smoke/smoke.mjs`
 * after `pnpm build`.
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PORT = 4173;

// Hard watchdog: CI must never hang on this script.
const WATCHDOG_MS = 120_000;
const watchdog = setTimeout(() => {
  console.error(`smoke: timed out after ${WATCHDOG_MS / 1000}s`);
  shutdown(1);
}, WATCHDOG_MS);

const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
  cwd: path.join(root, "packages/client"),
  stdio: "pipe",
  detached: true // own process group so we can kill vite, not just the npx wrapper
});
function shutdown(code) {
  clearTimeout(watchdog);
  try { process.kill(-server.pid, "SIGTERM"); } catch { /* already gone */ }
  process.exit(code);
}
await waitForServer(`http://localhost:${PORT}/`, 30_000);

const errors = [];
try {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });

  for (const [name, viewport] of [
    ["desktop", { width: 1280, height: 720 }],
    ["phone-landscape", { width: 844, height: 390 }]
  ]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    page.on("console", (m) => { if (m.type() === "error") errors.push(`[${name}] ${m.text()}`); });
    page.on("pageerror", (e) => errors.push(`[${name}] ${e.message}`));
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1800); // kickoff delay
    // Sprint forward, then shoot.
    await page.keyboard.down("KeyW");
    await page.keyboard.down("ShiftLeft");
    await page.waitForTimeout(1200);
    await page.keyboard.up("ShiftLeft");
    await page.keyboard.down("KeyK");
    await page.waitForTimeout(500);
    await page.keyboard.up("KeyK");
    await page.keyboard.up("KeyW");
    await page.waitForTimeout(800);
    const score = await page.textContent(".scoreboard");
    const status = await page.textContent(".status");
    console.info(`[${name}] scoreboard="${score?.trim()}" status="${status?.trim()}"`);
    await page.screenshot({ path: path.join(root, `tools/smoke/${name}.png`) });
    await page.close();
  }
  await browser.close();
} catch (e) {
  console.error("smoke failed:", e);
  shutdown(1);
}

if (errors.length) {
  console.error("Console errors:\n" + errors.join("\n"));
  shutdown(1);
}
console.info("smoke OK");
shutdown(0);

async function waitForServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`preview server did not start within ${timeoutMs / 1000}s`);
}
