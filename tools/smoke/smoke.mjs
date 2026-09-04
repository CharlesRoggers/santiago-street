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

const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
  cwd: path.join(root, "packages/client"),
  stdio: "pipe"
});
await new Promise((r) => setTimeout(r, 2500));

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
} finally {
  server.kill();
}

if (errors.length) {
  console.error("Console errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.info("smoke OK");
