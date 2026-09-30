// H2 WEATHER — "you feel volatility with your hands" (P2.3 / ART-DIRECTION §4).
// PURE module: candles in, weather out — no fetch, no Date.now(), no
// Math.random(). The same (symbol, date) terrain always derives the same
// weather (W5 invariant); the renderer may only VISUALIZE these numbers, and
// no weather effect may ever break market legibility (ART-DIRECTION §1):
// wind sways background layers only, fog veils lookahead honestly, tremor is
// cosmetic camera noise. Physics/scoring/determinism untouched.
//
//   ATR     -> wind strength   (particle streaks + background sway)
//   volume  -> fog density     (right-edge lookahead veil; honestly data-driven)
//   red tail-> tremor          (subtle camera noise near danger-dense stretches)
import type { Candle } from "./types";
import { hashString } from "./rng";

export type WindLabel = "DEAD CALM" | "BREEZE" | "GALE" | "STORM";
export type FogLabel = "CLEAR" | "MIST" | "FOG" | "SOUP";

export interface Weather {
  wind: number; // 0..1 — ATR magnitude
  windDir: -1 | 1; // deterministic per level (seed-derived)
  fog: number; // 0..1 — volume fog density
  tremor: number; // 0..1 — red-tail density (cosmetic shake driver)
  atr: number; // raw tail ATR ratio (exposed for tests/HUD)
  windLabel: WindLabel;
  fogLabel: FogLabel;
}

/** Neutral weather for terrain without derivable stats (fallback paths). */
export const NEUTRAL_WEATHER: Weather = {
  wind: 0,
  windDir: 1,
  fog: 0.25,
  tremor: 0,
  atr: 0,
  windLabel: "DEAD CALM",
  fogLabel: "MIST",
};

const TAIL = 12; // last N candles define "the weather now"
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function windLabelOf(wind: number): WindLabel {
  return wind < 0.15 ? "DEAD CALM" : wind < 0.4 ? "BREEZE" : wind < 0.7 ? "GALE" : "STORM";
}

export function fogLabelOf(fog: number): FogLabel {
  return fog < 0.2 ? "CLEAR" : fog < 0.45 ? "MIST" : fog < 0.7 ? "FOG" : "SOUP";
}

/**
 * Derive weather from the SAME closed candles that shaped the terrain.
 * Wind: mean weekly range ratio over the tail, mapped 0.03..0.15 -> 0..1.
 * Fog: tail mean volume vs whole-series mean volume (no volume data — e.g.
 * synthetic or derived terrain — falls back to an honest MIST baseline).
 * Tremor: share of red candles in the tail (danger-dense stretches).
 */
export function deriveWeather(candles: Candle[], seedStr: string): Weather {
  if (!candles || candles.length < 2) return NEUTRAL_WEATHER;
  const tail = candles.slice(Math.max(0, candles.length - TAIL));

  // ---- ATR (range-ratio) wind ----
  let atrSum = 0;
  let red = 0;
  for (const c of tail) {
    const o = Math.abs(c.o) || 1;
    atrSum += (c.h - c.l) / o;
    if (c.c < c.o) red++;
  }
  const atr = atrSum / tail.length;
  const wind = clamp01((atr - 0.03) / 0.12);

  // ---- volume fog ----
  let fog: number;
  const tailVol = tail.reduce((s, c) => s + (typeof c.v === "number" && Number.isFinite(c.v) ? c.v : 0), 0);
  const tailHasVol = tail.some((c) => typeof c.v === "number" && Number.isFinite(c.v) && c.v > 0);
  if (tailHasVol) {
    let allVol = 0;
    let allN = 0;
    for (const c of candles) {
      if (typeof c.v === "number" && Number.isFinite(c.v) && c.v > 0) {
        allVol += c.v;
        allN++;
      }
    }
    if (allN > 0) {
      const ratio = tailVol / tail.length / (allVol / allN);
      fog = clamp01((ratio - 1) / 1.5); // 1.0x history -> clear, 2.5x -> SOUP
    } else {
      fog = NEUTRAL_WEATHER.fog;
    }
  } else {
    fog = NEUTRAL_WEATHER.fog; // no volume on the wire -> honest baseline
  }

  // ---- tremor (red-tail density) ----
  const redShare = red / tail.length;
  const tremor = clamp01((redShare - 0.35) / 0.4);

  return {
    wind,
    windDir: (hashString("cc-wind-dir:" + seedStr) & 1) === 1 ? 1 : -1,
    fog,
    tremor,
    atr,
    windLabel: windLabelOf(wind),
    fogLabel: fogLabelOf(fog),
  };
}
