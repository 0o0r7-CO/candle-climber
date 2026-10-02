// Yahoo Finance v8 chart parser (W3.1): PURE module — no fetch, no Date.now().
// W3.1 fix: stooq fronts an anti-bot challenge that BLOCKS Vercel's egress IPs,
// so prod served honest "synthetic" stock rails. Yahoo's keyless v8 chart API
// has no such challenge and is reachable from serverless functions — it becomes
// the PRIMARY stock feed; stooq stays as the fallback (parity of honesty: both
// feeds are real weekly OHLC, and the run-token pins whichever candles were
// used, so a feed swap can never mix terrains within a leaderboard).
//
// Wire contract (docs/FEEDS.md):
//   https://query1.finance.yahoo.com/v8/finance/chart/TSLA?interval=1wk&range=10y
//   { chart: { result: [ { timestamp: number[] (unix SECONDS, week start),
//       indicators: { quote: [ { open[], high[], low[], close[], volume[] } ] },
//       meta: { ... } } ], error: null } }
//   One row per calendar week; the trailing row is the IN-PROGRESS week.
//
// Anti-bot / failure responses are shapes without chart.result (HTML page,
// {"finance":{"error":...}}, rate-limit JSON) — those must parse as null,
// never throw. Mirrors src/lib/stooq.ts (same MIN_CLOSED_ROWS gate).
import type { Candle } from "@/game/cc/types";

export const MIN_CLOSED_ROWS_YAHOO = 40;

/** Weekly candle closes 7 days after its (week-start) timestamp. */
const WEEK_MS = 7 * 86_400_000;

export function yahooChartUrl(symbol: string, host: string): string {
  return `${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1wk&range=10y`;
}

/**
 * Parse a Yahoo v8 chart JSON body into CLOSED weekly candles, or null when
 * the payload is unusable. Malformed rows are skipped. `now` is the caller's
 * clock in ms so the module stays pure and testable — the in-progress week
 * (row week-start + 7d > now) is dropped, keeping terrain deterministic
 * within its UTC day (same rule as the stooq and binance paths).
 */
export function parseYahooChart(body: unknown, now: number): Candle[] | null {
  if (typeof body !== "object" || body === null) return null;
  const chart = (body as { chart?: unknown }).chart;
  if (typeof chart !== "object" || chart === null) return null;
  const results = (chart as { result?: unknown }).result;
  if (!Array.isArray(results) || results.length === 0) return null;
  const result = results[0] as {
    timestamp?: unknown;
    indicators?: { quote?: unknown };
  };
  const stamps = result.timestamp;
  const quotes = result.indicators?.quote;
  if (!Array.isArray(stamps) || !Array.isArray(quotes) || quotes.length === 0) return null;
  const q = quotes[0] as {
    open?: unknown[]; high?: unknown[]; low?: unknown[]; close?: unknown[]; volume?: unknown[];
  };
  if (!Array.isArray(q.open) || !Array.isArray(q.high) || !Array.isArray(q.low) || !Array.isArray(q.close)) {
    return null;
  }
  const out: Candle[] = [];
  for (let i = 0; i < stamps.length; i++) {
    const t = Number(stamps[i]) * 1000; // unix seconds -> ms
    const o = Number(q.open[i]), h = Number(q.high[i]), l = Number(q.low[i]), c = Number(q.close[i]);
    // null must NOT become 0 via Number() coercion — a null price is missing
    // data (halt/holiday stub rows), never a tradeable candle.
    if (q.open[i] == null || q.high[i] == null || q.low[i] == null || q.close[i] == null) continue;
    if (!Number.isFinite(t) || t <= 0) continue;
    if (![o, h, l, c].every(Number.isFinite)) continue;
    // Drop the in-progress week (week-start + 7d > now) — only CLOSED weeks
    // shape the terrain (W1 determinism, identical to the stooq parser).
    if (t + WEEK_MS > now) continue;
    const v = Number(q.volume?.[i]);
    out.push({ t, o, h, l, c, ...(Number.isFinite(v) && v > 0 ? { v } : {}) });
  }
  if (out.length < MIN_CLOSED_ROWS_YAHOO) return null;
  return out;
}
