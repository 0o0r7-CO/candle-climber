/// <reference types="bun-types" />
// W5 pins for H2 WEATHER (P2.3, bun test, zero deps). deriveWeather must be a
// PURE function of (candles, seedStr): deterministic, no wall clock, no input
// mutation. Labels follow fixed thresholds; fog falls back to an honest
// baseline when the feed carries no volume; render integration stays
// render-only (no engine changes — enforced by not importing the engine here).
import { describe, test, expect } from "bun:test";
import {
  deriveWeather,
  windLabelOf,
  fogLabelOf,
  NEUTRAL_WEATHER,
} from "@/game/cc/weather";
import { syntheticCandles, LIMIT } from "@/game/cc/level-source";
import { buildPlatforms } from "@/game/cc/level";
import type { Candle } from "@/game/cc/types";

const SEED = "2020-03-16BTCUSDT";
const c = (o: number, h: number, l: number, cl: number, v?: number): Candle => ({
  t: 0, o, h, l, c: cl, ...(v !== undefined ? { v } : {}),
});

describe("W5 deriveWeather purity & determinism", () => {
  test("same candles + same seed -> byte-identical weather", () => {
    const candles = syntheticCandles("2020-03-16", LIMIT);
    const a = JSON.stringify(deriveWeather(candles, SEED));
    const b = JSON.stringify(deriveWeather(candles, SEED));
    expect(a).toBe(b);
  });

  test("NEVER mutates the input candles", () => {
    const candles = syntheticCandles("2020-03-16", LIMIT);
    const before = JSON.stringify(candles);
    deriveWeather(candles, SEED);
    expect(JSON.stringify(candles)).toBe(before);
  });

  test("wind magnitude is seed-independent (only direction may flip)", () => {
    const candles = syntheticCandles("2020-03-16", LIMIT);
    const a = deriveWeather(candles, "seedA");
    const b = deriveWeather(candles, "seedB");
    expect(a.wind).toBe(b.wind);
    expect(a.atr).toBe(b.atr);
    expect(a.windLabel).toBe(b.windLabel);
    expect([-1, 1]).toContain(a.windDir);
    expect([-1, 1]).toContain(b.windDir);
  });

  test("degenerate input -> NEUTRAL_WEATHER (never throws)", () => {
    expect(deriveWeather([], SEED)).toEqual(NEUTRAL_WEATHER);
    expect(deriveWeather([c(100, 101, 99, 100)], SEED)).toEqual(NEUTRAL_WEATHER);
  });

  test("wind labels are a fixed threshold ladder", () => {
    expect(windLabelOf(0)).toBe("DEAD CALM");
    expect(windLabelOf(0.14)).toBe("DEAD CALM");
    expect(windLabelOf(0.15)).toBe("BREEZE");
    expect(windLabelOf(0.399)).toBe("BREEZE");
    expect(windLabelOf(0.4)).toBe("GALE");
    expect(windLabelOf(0.699)).toBe("GALE");
    expect(windLabelOf(0.7)).toBe("STORM");
    expect(windLabelOf(1)).toBe("STORM");
  });

  test("fog labels are a fixed threshold ladder", () => {
    expect(fogLabelOf(0)).toBe("CLEAR");
    expect(fogLabelOf(0.19)).toBe("CLEAR");
    expect(fogLabelOf(0.2)).toBe("MIST");
    expect(fogLabelOf(0.449)).toBe("MIST");
    expect(fogLabelOf(0.45)).toBe("FOG");
    expect(fogLabelOf(0.699)).toBe("FOG");
    expect(fogLabelOf(0.7)).toBe("SOUP");
  });
});

describe("W5 wind derivation (ATR -> wind)", () => {
  test("quiet stretch -> DEAD CALM (wind 0)", () => {
    const candles = Array.from({ length: 20 }, () => c(100, 102, 98.8, 101));
    // tail range ratio = (102-98.8)/100 = 0.032 -> wind ~0.017 < 0.15
    const w = deriveWeather(candles, SEED);
    expect(w.windLabel).toBe("DEAD CALM");
    expect(w.wind).toBeLessThan(0.15);
  });

  test("COVID-style monster tail -> STORM (wind 1)", () => {
    const candles = Array.from({ length: 20 }, () => c(100, 104, 96, 101));
    candles[candles.length - 1] = c(100, 190, 55, 70); // range ratio 1.35
    const w = deriveWeather(candles, SEED);
    expect(w.wind).toBe(1);
    expect(w.windLabel).toBe("STORM");
  });

  test("only the TAIL counts: past storm does not weather today", () => {
    const candles = Array.from({ length: 40 }, () => c(100, 102, 98.8, 101));
    candles[0] = c(100, 200, 50, 60); // prehistoric monster, outside the tail
    expect(deriveWeather(candles, SEED).wind).toBeLessThan(0.15);
  });
});

describe("W5 fog derivation (volume -> lookahead veil)", () => {
  test("recent volume above history raises fog; below history clears it", () => {
    const base = Array.from({ length: 40 }, () => c(100, 104, 96, 101, 1000));
    const hot = base.slice();
    for (let i = hot.length - 12; i < hot.length; i++) hot[i] = c(100, 104, 96, 101, 3000);
    const calm = base.slice();
    for (let i = calm.length - 12; i < calm.length; i++) calm[i] = c(100, 104, 96, 101, 400);
    const fogHot = deriveWeather(hot, SEED).fog;
    const fogCalm = deriveWeather(calm, SEED).fog;
    expect(fogHot).toBeGreaterThan(fogCalm);
    expect(fogHot).toBeGreaterThan(0); // 3x tail volume -> fog rises
    expect(fogCalm).toBe(0); // 0.4x tail volume -> CLEAR
  });

  test("extreme volume spike saturates at SOUP (fog 1)", () => {
    const base = Array.from({ length: 40 }, () => c(100, 104, 96, 101, 1000));
    for (let i = base.length - 12; i < base.length; i++) base[i] = c(100, 104, 96, 101, 10000);
    const w = deriveWeather(base, SEED);
    expect(w.fog).toBe(1);
    expect(w.fogLabel).toBe("SOUP");
  });

  test("no volume on the wire -> honest MIST baseline (synthetic terrain)", () => {
    const candles = syntheticCandles("2020-03-16", LIMIT); // synthetic has no v
    const w = deriveWeather(candles, SEED);
    expect(w.fog).toBe(NEUTRAL_WEATHER.fog);
    expect(w.fogLabel).toBe("MIST");
  });

  test("volume-less candles mixed with volume candles: baseline applies when tail lacks volume", () => {
    const vol: Candle[] = [];
    for (let i = 0; i < 40; i++) vol.push(c(100, 104, 96, 101, i < 28 ? 1000 : undefined));
    const w = deriveWeather(vol, SEED); // tail (last 12) has NO volume
    expect(w.fog).toBe(NEUTRAL_WEATHER.fog);
  });
});

describe("W5 tremor derivation (red-tail density)", () => {
  test("green tail -> no tremor; red-dense tail -> tremor rises, capped at 1", () => {
    const green = Array.from({ length: 20 }, () => c(100, 104, 96, 104));
    expect(deriveWeather(green, SEED).tremor).toBe(0);
    const red = Array.from({ length: 20 }, (_, i) =>
      c(100, 104, 96, i % 3 === 0 ? 104 : 96),
    );
    // red share 2/3 -> (0.667-0.35)/0.4 = 0.79
    expect(deriveWeather(red, SEED).tremor).toBeGreaterThan(0.5);
  });
});

describe("W5 weather integrates with real level pipeline (render-only contract)", () => {
  test("synthetic daily terrain derives stable weather; platforms unaffected", () => {
    const candles = syntheticCandles("2026-09-30", LIMIT);
    const platsBefore = JSON.stringify(buildPlatforms(candles, "2026-09-30BTCUSDT"));
    const w = deriveWeather(candles, "2026-09-30BTCUSDT");
    expect(JSON.stringify(buildPlatforms(candles, "2026-09-30BTCUSDT"))).toBe(platsBefore);
    expect(JSON.stringify(deriveWeather(candles, "2026-09-30BTCUSDT"))).toBe(JSON.stringify(w));
    expect(w.wind).toBeGreaterThanOrEqual(0);
    expect(w.wind).toBeLessThanOrEqual(1);
    expect(w.fog).toBeGreaterThanOrEqual(0);
    expect(w.fog).toBeLessThanOrEqual(1);
  });
});
