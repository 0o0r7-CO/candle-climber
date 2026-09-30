/**
 * E2E GAMER BOT — production smoke test (owner directive 2026-10-01)
 *
 * A robot player for Candle Climber. Runs against the live deployment,
 * plays the game like a human (jump bursts + RUSH), captures screenshots
 * and console logs, and fails on any uncaught page error or non-whitelisted
 * console error. Designed for GitHub Actions (free) on every push + nightly.
 *
 * Run:  bun scripts/e2e-gamer-bot.ts
 * Env:  GAME_URL (default prod ?renderer=v2) · RUN_SECONDS (default 24)
 * Out:  e2e-artifacts/ (screenshots + summary.json) — uploaded as CI artifact.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const GAME_URL = process.env.GAME_URL || "https://candle-climber.vercel.app/?renderer=v2";
const RUN_SECONDS = Number(process.env.RUN_SECONDS || 24);
// NO_RUSH=1 → clean baseline (owner-feedback F1/F2 metric): no risk bursts,
// measures honest time-to-first-death on today's terrain.
const NO_RUSH = process.env.NO_RUSH === "1";
const ART = join(process.cwd(), "e2e-artifacts");

// Benign console errors we must not fail on (network noise etc.)
const CONSOLE_WHITELIST: RegExp[] = [
  /Failed to load resource/i,
  /favicon/i,
];

type LogLine = { t: string; kind: string; text: string };
const logs: LogLine[] = [];
const stamp = () => new Date().toISOString().slice(11, 23);
const log = (m: string) => console.log(`[bot ${stamp()}] ${m}`);

async function main() {
  mkdirSync(ART, { recursive: true });
  const summary: Record<string, unknown> = { url: GAME_URL, runSeconds: RUN_SECONDS };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on("pageerror", (err) => pageErrors.push(String(err?.message ?? err)));
  page.on("console", (msg) => {
    const text = msg.text();
    const kind = msg.type();
    logs.push({ t: stamp(), kind, text });
    if (kind === "error" && !CONSOLE_WHITELIST.some((re) => re.test(text))) {
      consoleErrors.push(text);
    }
  });

  log(`goto ${GAME_URL}`);
  await page.goto(GAME_URL, { timeout: 60_000, waitUntil: "domcontentloaded" });

  // 1) Boot assertions — stage + canvas must exist with real dimensions
  const canvas = page.locator("canvas.cc-canvas");
  await canvas.waitFor({ state: "visible", timeout: 30_000 });
  const box = await canvas.boundingBox();
  if (!box || box.width < 100 || box.height < 100) {
    throw new Error(`canvas has no real size: ${JSON.stringify(box)}`);
  }
  summary.canvas = box;
  log(`canvas ok ${Math.round(box.width)}x${Math.round(box.height)}`);

  await page.screenshot({ path: join(ART, "01-boot.png"), fullPage: false });

  // 2) Start the run (Space starts from the ready panel; button is fallback)
  const startBtn = page.getByRole("button", { name: /start climb/i });
  if (await startBtn.isVisible().catch(() => false)) {
    await startBtn.click();
    log("started via START CLIMB button");
  } else {
    await page.keyboard.press("Space");
    log("started via Space");
  }
  await page.waitForTimeout(1200);

  // 3) Play like a player: jump bursts + occasional RUSH, for RUN_SECONDS
  const start = Date.now();
  let deathPanels = 0;
  let firstDeathAt: number | null = null;
  let i = 0;
  while ((Date.now() - start) / 1000 < RUN_SECONDS) {
    i++;
    // hold jump for a short or long burst (variable timing = less robotic)
    const hold = 220 + Math.round(Math.random() * 420);
    await page.keyboard.down("Space");
    await page.waitForTimeout(hold);
    await page.keyboard.up("Space");

    if (!NO_RUSH && i % 6 === 0) {
      await page.keyboard.down("Shift"); // RUSH
      await page.waitForTimeout(1500);
      await page.keyboard.up("Shift");
      log("RUSH burst");
    }

    // death panel? that is VALID behavior — count it and retry to keep playing
    const retry = page.getByRole("button", { name: /retr(y|ies)/i });
    if (await retry.isVisible().catch(() => false)) {
      deathPanels++;
      if (firstDeathAt === null) firstDeathAt = Math.round((Date.now() - start) / 1000);
      const shot = join(ART, `death-${deathPanels}.png`);
      await page.screenshot({ path: shot });
      log(`death panel #${deathPanels} captured → retry`);
      await page.keyboard.press("Space");
      await page.waitForTimeout(800);
    }

    await page.waitForTimeout(320 + Math.round(Math.random() * 380));

    if (i % 5 === 0) {
      const n = i / 5;
      await page.screenshot({ path: join(ART, `play-${String(n).padStart(2, "0")}.png`) });
      log(`screenshot play-${String(n).padStart(2, "0")}`);
    }
  }

  // 4) Rendering liveness — two canvas frames must differ (game is animating)
  const f1 = await canvas.screenshot();
  await page.waitForTimeout(700);
  const f2 = await canvas.screenshot();
  const animating = !f1.equals(f2);
  summary.canvasAnimating = animating;
  log(`canvas animating: ${animating}`);

  await page.screenshot({ path: join(ART, "99-final.png") });

  // 5) Verdict
  summary.pageErrors = pageErrors;
  summary.consoleErrors = consoleErrors;
  summary.deathPanels = deathPanels;
  summary.firstDeathAtSec = firstDeathAt;
  summary.noRushBaseline = NO_RUSH;
  summary.consoleLogLines = logs.length;
  writeFileSync(join(ART, "summary.json"), JSON.stringify(summary, null, 2));
  writeFileSync(
    join(ART, "console.log"),
    logs.map((l) => `${l.t} [${l.kind}] ${l.text}`).join("\n"),
  );

  await browser.close();

  const failures: string[] = [];
  if (!animating) failures.push("canvas is static — game is not rendering");
  if (pageErrors.length > 0) failures.push(`pageerror x${pageErrors.length}: ${pageErrors[0]}`);
  if (consoleErrors.length > 0) failures.push(`console.error x${consoleErrors.length}: ${consoleErrors[0]}`);

  if (failures.length > 0) {
    console.error(`[bot] FAIL — ${failures.join(" | ")}`);
    process.exit(1);
  }
  log(`PASS — played ${RUN_SECONDS}s, ${deathPanels} deaths (valid), ${logs.length} console lines, 0 uncaught errors`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`[bot] CRASH — ${err?.stack ?? err}`);
  process.exit(1);
});
