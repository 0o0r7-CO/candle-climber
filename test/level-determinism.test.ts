/// <reference types="bun-types" />
// W5 determinism pins for the level builder (bun test, zero deps).
// Extends 30-b's summit coverage: buildPlatforms must be a PURE function of
// (candles, seedString) — same inputs, byte-identical platforms; different
// seed, different terrain; summit still exactly on the LAST platform.
// Fixtures cover the three terrain shapes the app really feeds it:
//   - synthetic (the tokenless fallback, via syntheticCandles)
//   - stock-shaped (stooq weekly rails: steady uptrend, occasional red week)
//   - launch-shaped (vibe/vibe launch-of-the-day, via pure vibeLaunchCandles)
// No network: every fixture is generated locally.
import { describe, test, expect } from "bun:test";
import { buildPlatforms } from "@/game/cc/level";
import { syntheticCandles, LIMIT } from "@/game/cc/level-source";
import { vibeLaunchCandles, type VibeLaunch } from "@/lib/vibe-launch";
import type { Candle } from "@/game/cc/types";

/* ------------------------------- fixtures -------------------------------- */

const DAY_MS = 86_400_000;
const DATE = "2026-09-30";

// real-payload-shaped launch fixture (research-cache/launches_ALL.json shape)
const LAUNCH: VibeLaunch = {
  launchId: "cc-test-launch-001",
  symbol: "OFFL",
  createdAt: "2026-07-01T00:00:00.000Z", // exactly 91 full days before DATE T00:00 -> floor(91) -> count 151
  graduated: true,
  holderCount: 312,
  volume24hPairUnits: "1530000000000000000000", // 18-decimal units, ~1530 pair units
  buyCount24h: 812,
  sellCount24h: 733,
};

/** Stooq-shaped weekly candles: steady uptrend, a red week every 7th, real wicks. */
function stockShapedCandles(count: number): Candle[] {
  const out: Candle[] = [];
  let price = 12;
  const t0 = Date.parse("2022-07-01T00:00:00Z");
  for (let i = 0; i < count; i++) {
    const o = price;
    const move = 0.006 + (i % 7 === 3 ? -0.012 : 0); // mostly up, occasional red week
    const c = Math.max(1, o * (1 + move));
    const h = Math.max(o, c) * 1.008;
    const l = Math.min(o, c) * 0.992;
    out.push({ t: t0 + i * 7 * DAY_MS, o, h, l, c });
    price = c;
  }
  return out;
}

const FIXTURES: Array<{ name: string; candles: Candle[] }> = [
  { name: "synthetic 2026-09-30", candles: syntheticCandles(DATE, LIMIT) },
  { name: "synthetic 2026-01-15", candles: syntheticCandles("2026-01-15", LIMIT) },
  { name: "stock-shaped (stooq-like)", candles: stockShapedCandles(LIMIT) },
  { name: "launch-shaped (vibe/vibe)", candles: vibeLaunchCandles(LAUNCH, DATE) },
];

const SEEDS = [`${DATE}SOLUSDT`, `${DATE}TSLA`, `${DATE}OFFL`, "2026-01-15BTCUSDT"];

/* --------------------------------- tests --------------------------------- */

describe("W5 buildPlatforms determinism", () => {
  test("same candles + same seedString x2 -> byte-identical platform arrays", () => {
    for (const f of FIXTURES) {
      for (const seedStr of SEEDS) {
        const a = JSON.stringify(buildPlatforms(f.candles, seedStr));
        const b = JSON.stringify(buildPlatforms(f.candles, seedStr));
        expect(a).toBe(b); // byte-identical, not merely deep-equal
        expect(buildPlatforms(f.candles, seedStr)).toEqual(buildPlatforms(f.candles, seedStr));
      }
    }
  });

  test("different seed -> different terrain (per fixture)", () => {
    for (const f of FIXTURES) {
      const seeds = [`${DATE}SOLUSDT`, `${DATE}BTCUSDT`];
      const a = JSON.stringify(buildPlatforms(f.candles, seeds[0]));
      const b = JSON.stringify(buildPlatforms(f.candles, seeds[1]));
      expect(a).not.toBe(b);
    }
  });

  test("summit flag exactly on the LAST platform, for every fixture x seed", () => {
    for (const f of FIXTURES) {
      for (const seedStr of SEEDS) {
        const plats = buildPlatforms(f.candles, seedStr);
        expect(plats.length).toBe(f.candles.length);
        const summitIdx = plats.map((p, i) => (p.summit ? i : -1)).filter((i) => i >= 0);
        expect(summitIdx).toEqual([plats.length - 1]);
      }
    }
  });

  test("launch-shaped fixture really is launch terrain (length from real age)", () => {
    // 2026-07-01 -> 2026-09-30 = 91 days old -> count = clamp(60, 60+91, 219) = 151
    const candles = vibeLaunchCandles(LAUNCH, DATE);
    expect(candles.length).toBe(151);
    const plats = buildPlatforms(candles, `${DATE}OFFL`);
    expect(plats.length).toBe(candles.length);
    expect(plats[plats.length - 1].summit).toBe(true);
  });
});
