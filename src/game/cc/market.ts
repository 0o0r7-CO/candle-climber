// Real-market legibility stats — connects the level to the actual chart it came from.
// Pure functions over the SAME candle data the level was built from.
import type { Candle } from "./types";

export interface MarketStats {
  changePct: number; // first open -> last close, %
  redRatio: number; // share of red candles
  volatility: number; // avg |close-open| / open
  difficulty: "FRIENDLY" | "SPICY" | "BRUTAL";
}

export function marketStats(candles: Candle[]): MarketStats | null {
  if (!candles || candles.length < 2) return null;
  const first = candles[0];
  const last = candles[candles.length - 1];
  const changePct = ((last.c - first.o) / (Math.abs(first.o) || 1)) * 100;
  let red = 0;
  let vol = 0;
  for (const c of candles) {
    if (c.c < c.o) red++;
    vol += Math.abs(c.c - c.o) / (Math.abs(c.o) || 1);
  }
  const redRatio = red / candles.length;
  const volatility = vol / candles.length;

  let difficulty: MarketStats["difficulty"] = "SPICY";
  if (changePct <= -8 || redRatio >= 0.58 || volatility > 0.05) difficulty = "BRUTAL";
  else if (changePct >= 5 && redRatio <= 0.38 && volatility < 0.03) difficulty = "FRIENDLY";

  return { changePct, redRatio, volatility, difficulty };
}

export function fmtPct(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}
