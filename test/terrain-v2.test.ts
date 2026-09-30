/// <reference types="bun-types" />
// W5 pins for the V1 visual translation layer (P2.1/P2.6, bun test, zero deps).
// buildTerrainV2 must be a PURE function of (plats, seedStr):
//   - same inputs -> byte-identical decor (render determinism, W5 invariant)
//   - different seed -> different decor
//   - NO mutation of the input platforms (engine owns them)
//   - semantic rule (ART-DIRECTION §1): up/down identity + gap + summit flags
//     carried through EXACTLY; decor never contradicts the market semantics
//   - grammar: tall upper wicks produce hanging spikes, tall lower wicks produce
//     roots, gaps produce chasm slabs with NO material decor, summit exactly once
// Fixtures reuse the same three terrain shapes the app really feeds it.
import { describe, test, expect } from "bun:test";
import { buildPlatforms } from "@/game/cc/level";
import { syntheticCandles, LIMIT } from "@/game/cc/level-source";
import { buildTerrainV2, type SlabDecor } from "@/game/cc/terrain-v2";
import type { Platform } from "@/game/cc/types";

const DATE = "2026-09-30";
const SEED = `${DATE}SOLUSDT`;

const plats = buildPlatforms(syntheticCandles(DATE, LIMIT), SEED);

/** Hand-built platform with explicit wick geometry (for grammar edge cases). */
function mk(over: Partial<Platform>, i: number): Platform {
  return {
    i, x: i * 96, w: 62, y: 200,
    bodyTop: 210, bodyBottom: 250, wickTop: 190, wickBottom: 270,
    up: true, crumble: false, state: "solid", crumbleT: 0, passed: false,
    ...over,
  };
}

describe("W5 buildTerrainV2 purity & determinism", () => {
  test("same plats + same seedString x2 -> byte-identical decor", () => {
    const a = JSON.stringify(buildTerrainV2(plats, SEED));
    const b = JSON.stringify(buildTerrainV2(plats, SEED));
    expect(a).toBe(b);
  });

  test("different seed -> different decor (per level identity)", () => {
    const a = JSON.stringify(buildTerrainV2(plats, `${DATE}SOLUSDT`));
    const b = JSON.stringify(buildTerrainV2(plats, `${DATE}BTCUSDT`));
    expect(a).not.toBe(b);
  });

  test("NEVER mutates the input platforms (engine owns them)", () => {
    const before = JSON.stringify(plats);
    buildTerrainV2(plats, SEED);
    expect(JSON.stringify(plats)).toBe(before);
  });

  test("appending World-2 chunks does not change earlier decor", () => {
    const base = JSON.stringify(buildTerrainV2(plats, SEED).slabs.slice(0, 100));
    const grown = buildTerrainV2([...plats, ...plats], SEED).slabs.slice(0, 100);
    expect(JSON.stringify(grown)).toBe(base);
  });
});

describe("W5 buildTerrainV2 semantics & grammar", () => {
  const t = buildTerrainV2(plats, SEED);

  test("index-aligned: one slab per platform, i preserved", () => {
    expect(t.slabs.length).toBe(plats.length);
    for (let k = 0; k < plats.length; k++) expect(t.slabs[k].i).toBe(plats[k].i);
  });

  test("up/gap/summit carried through EXACTLY (market semantics)", () => {
    for (let k = 0; k < plats.length; k++) {
      const p = plats[k], d = t.slabs[k];
      expect(d.up).toBe(p.up);
      expect(d.gap).toBe(p.state === "gone" || p.w === 0);
      expect(d.summit).toBe(Boolean(p.summit));
    }
    // summit exactly once, on the last platform
    const summits = t.slabs.filter((s) => s.summit);
    expect(summits.length).toBe(1);
    expect(summits[0].i).toBe(plats.length - 1);
  });

  test("gap slabs carry NO material decor (chasm, not a half-dressed platform)", () => {
    const gaps = t.slabs.filter((s) => s.gap);
    for (const g of gaps) {
      expect(g.veins).toEqual([]);
      expect(g.crystals).toEqual([]);
      expect(g.cracks).toEqual([]);
      expect(g.embers).toEqual([]);
      expect(g.spikes).toEqual([]);
      expect(g.roots).toEqual([]);
    }
  });

  test("tall upper wick -> hanging spikes; flat wick -> none", () => {
    const tall = buildTerrainV2([mk({ bodyTop: 250, wickTop: 150, up: true }, 0)], "S").slabs[0];
    expect(tall.spikes.length).toBeGreaterThanOrEqual(1);
    const flat = buildTerrainV2([mk({ bodyTop: 200, wickTop: 195, up: true }, 0)], "S").slabs[0];
    expect(flat.spikes.length).toBe(0);
  });

  test("tall lower wick -> roots; shallow -> none", () => {
    const deep = buildTerrainV2([mk({ bodyBottom: 220, wickBottom: 320, up: true }, 0)], "S").slabs[0];
    expect(deep.roots.length).toBeGreaterThanOrEqual(1);
    const shallow = buildTerrainV2([mk({ bodyBottom: 260, wickBottom: 264, up: true }, 0)], "S").slabs[0];
    expect(shallow.roots.length).toBe(0);
  });

  test("green slabs may carry veins/crystals, red slabs never do (and vice versa)", () => {
    const green: SlabDecor[] = t.slabs.filter((s) => !s.gap && s.up);
    const red: SlabDecor[] = t.slabs.filter((s) => !s.gap && !s.up);
    expect(green.length).toBeGreaterThan(0);
    expect(red.length).toBeGreaterThan(0);
    for (const g of green) { expect(g.cracks).toEqual([]); expect(g.embers).toEqual([]); }
    for (const r of red) { expect(r.veins).toEqual([]); expect(r.crystals).toEqual([]); }
  });

  test("sky/ghost/fog parameters are in range", () => {
    expect(t.skyPhase).toBeGreaterThanOrEqual(0);
    expect(t.skyPhase).toBeLessThan(1);
    expect(t.ghostScale).toBeGreaterThanOrEqual(2.1);
    expect(t.ghostScale).toBeLessThanOrEqual(3.0);
    expect(t.fogAlpha).toBeGreaterThanOrEqual(0.7);
    expect(t.fogAlpha).toBeLessThanOrEqual(1.0);
  });
});
