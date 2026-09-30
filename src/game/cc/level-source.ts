// Level source — single authority for "which chart is today's level" and the
// deterministic synthetic fallback. Used by the server proxy (/api/candles) AND
// by the client when the API is unreachable, so the game is always playable
// and every client derives identical data from the same seed.
// E2 note (ECOSYSTEM_BAR): this module is the future plug point for the
// vibe/vibe launch feed — platform-launched tokens become level inputs here,
// without touching the engine or the API contract.
import { hashString, mulberry32 } from "./rng";
import type { Candle } from "./types";

export const WATCHLIST = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "DOGEUSDT", "XRPUSDT", "BNBUSDT"];
// Stock rails (W3): real weekly candles from stooq — same engine, same rules.
export const STOCKS = ["TSLA", "AMZN", "NFLX"];
// Everything a deep link (?symbol=) may pin: crypto rotation + stock rails.
export const ALL_SYMBOLS = [...WATCHLIST, ...STOCKS];
export const INTERVAL = "1w";
export const LIMIT = 220;

// P3.5 timeframe selector (owner proposal, tech-reviewed ACCEPT): the classic
// weekly level stays the default; 1d/4h/1h re-shape the SAME daily symbol
// rotation into shorter windows. Seed keys carry the interval so every
// timeframe is its own deterministic terrain; leaderboards never mix tfs.
export const INTERVALS = ["1w", "1d", "4h", "1h"] as const;
export type GameInterval = (typeof INTERVALS)[number];
export function isInterval(v: unknown): v is GameInterval {
  return typeof v === "string" && (INTERVALS as readonly string[]).includes(v);
}
export const INTERVAL_MS: Record<GameInterval, number> = {
  "1h": 3_600_000,
  "4h": 14_400_000,
  "1d": 86_400_000,
  "1w": 604_800_000,
};

export function pickSeed(date: string) {
  const h = hashString("cc-daily-v1:" + date);
  const rnd = mulberry32(h);
  const symbol = WATCHLIST[Math.floor(rnd() * WATCHLIST.length)];
  return { symbol, rnd };
}

// interval-aware synthetic fallback (P3.5): "1w" keeps the legacy seed path
// BYTE-IDENTICAL (existing pinned terrains/tests), other tfs seed on
// `date|interval` so 1h/4h/1d of the same day are distinct terrains.
export function syntheticCandles(date: string, count: number, interval: GameInterval = "1w"): Candle[] {
  const { rnd } = pickSeed(interval === "1w" ? date : `${date}|${interval}`);
  const step = INTERVAL_MS[interval];
  const out: Candle[] = [];
  let price = 100 + rnd() * 400;
  let drift = (rnd() - 0.5) * 0.02;
  let t = Date.parse(date + "T00:00:00Z") - count * step;
  for (let i = 0; i < count; i++) {
    if (rnd() < 0.08) drift = (rnd() - 0.5) * 0.04; // trend shifts
    const o = price;
    const move = drift + (rnd() - 0.5) * 0.06;
    const c = Math.max(1, o * (1 + move));
    const wick = Math.abs(move) * (0.4 + rnd()) + rnd() * 0.01;
    const h = Math.max(o, c) * (1 + wick);
    const l = Math.min(o, c) * (1 - wick);
    out.push({ t: t + i * step, o, h, l, c });
    price = c;
  }
  return out;
}
