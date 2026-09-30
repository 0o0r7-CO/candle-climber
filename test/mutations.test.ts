/// <reference types="bun-types" />
// P3.2 candle-rain mutation variant — contract tests (bun test, canvas-free).
// Two invariants matter:
//  a) FAIRNESS: the "rain" mutation is decor-only — mods deep-equal BASE_MODS,
//     so a rain day is exactly as hard as a clean day (score economy intact).
//  b) DETERMINISM: rain glyph geometry is a pure function of (index, engine
//     time, seed) — same inputs ⇒ same frame, engine physics never touched.
import { describe, test, expect } from "bun:test";
import { dailyMutation, mutationById, BASE_MODS, POOL } from "@/game/cc/mutations";
import { rainGlyph } from "@/game/cc/rain";

describe("P3.2 mutation pool (candle-rain)", () => {
  test("pool holds unique ids and stays seed-addressable", () => {
    const ids = POOL.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of POOL) {
      expect(m.name.length).toBeGreaterThan(0);
      expect(m.tagline.length).toBeGreaterThan(0);
      for (const v of Object.values(m.mods)) expect(Number.isFinite(v)).toBe(true);
    }
  });

  test("rain entry is DECOR-ONLY: mods deep-equal BASE_MODS", () => {
    const rain = mutationById("rain");
    expect(rain).toBeDefined();
    expect(rain!.mods).toEqual(BASE_MODS);
  });

  test("dailyMutation stays deterministic and in-pool across many seeds", () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 60; d++) {
      const seed = `2026-09-${String(d).padStart(2, "0")}BTCUSDT`;
      const m = dailyMutation(seed);
      expect(m).toBe(dailyMutation(seed)); // same seed ⇒ same mutation, always
      expect(POOL).toContain(m);
      seen.add(m.id);
    }
    // every pool entry is reachable across a month of seeds (no dead variant)
    for (const m of POOL) expect(seen.has(m.id)).toBe(true);
  });
});

describe("P3.2 candle-rain glyph geometry (pure)", () => {
  const W = 960, H = 540, SEED = "2026-10-01ETHUSDT";

  test("same index + time + seed ⇒ identical glyph (canvas-free determinism)", () => {
    const a = rainGlyph(7, 12.34, SEED, W, H);
    const b = rainGlyph(7, 12.34, SEED, W, H);
    expect(a).toEqual(b);
  });

  test("glyphs fall: y advances with engine time and wraps in bounds", () => {
    const t0 = rainGlyph(3, 0, SEED, W, H);
    const t1 = rainGlyph(3, 0.5, SEED, W, H);
    expect(t1.y).not.toBe(t0.y);
    for (let t = 0; t < 120; t += 7) {
      const g = rainGlyph(3, t, SEED, W, H);
      expect(g.y).toBeGreaterThanOrEqual(-40);
      expect(g.y).toBeLessThanOrEqual(H + 40);
      expect(g.x).toBeGreaterThanOrEqual(-60);
      expect(g.x).toBeLessThanOrEqual(W + 60);
    }
  });

  test("glyphs spread across lanes; palette only up/down", () => {
    const xs = new Set<number>();
    for (let i = 0; i < 34; i++) {
      const g = rainGlyph(i, 5, SEED, W, H);
      xs.add(Math.round(g.x));
      expect(typeof g.up).toBe("boolean");
      expect(g.alpha).toBeGreaterThanOrEqual(0.12);
      expect(g.alpha).toBeLessThanOrEqual(0.32);
    }
    expect(xs.size).toBeGreaterThan(20); // not stacked on one lane
  });
});
