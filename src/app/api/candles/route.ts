// /api/candles — daily level data: seeded symbol rotation + market-data proxies.
// Level source logic (seed, watchlist, synthetic fallback) lives in
// src/game/cc/level-source.ts so the client can derive identical data offline.
// W1 integrity: ?symbol= is honored when whitelisted, the in-progress weekly
// candle is dropped (only CLOSED candles shape the terrain), and the response
// carries an HMAC runToken that pins symbol+date+terrain for the leaderboard.
// W3 rails: stock pairs via stooq weekly CSV (?symbol=TSLA|AMZN|NFLX) and the
// vibe/vibe launch-of-the-day as a derived secondary source (?source=launch).
// The server ALWAYS pins the date to today (utcDateStr) — no client date input.
import { NextResponse } from "next/server";
import { utcDateStr } from "@/game/cc/rng";
import { pickSeed, syntheticCandles, INTERVAL, LIMIT, WATCHLIST, STOCKS } from "@/game/cc/level-source";
import { signRunToken } from "@/lib/run-token";
import { getLaunchOfDay, launchSymbol, vibeLaunchCandles } from "@/lib/vibe-launch";
import type { Candle, CandleData, SeedInfo } from "@/game/cc/types";

type Source = SeedInfo["source"]; // "binance" | "stooq" | "vibe-launch" | "synthetic"
interface CacheEntry { ts: number; candles: Candle[]; source: Source }
const cache = new Map<string, CacheEntry>();
const TTL = 24 * 60 * 60 * 1000; // 24h — closed-candle terrain never changes within its UTC day

// Hosts are tried in order. api.binance.com geo-blocks some datacenter IPs
// (e.g. US-hosted serverless functions -> HTTP 451), so the official
// market-data mirror data-api.binance.vision is the second host.
const BINANCE_HOSTS = [
  "https://api.binance.com",
  "https://data-api.binance.vision",
];

// Stooq weekly CSV (free, keyless): https://stooq.com/q/d/l/?s=tsla.us&i=w
// One row per week; header Date,Open,High,Low,Close,Volume. Parsed with plain
// string splitting — no dependencies. See docs/FEEDS.md for the failure modes
// (it serves a JS challenge to some datacenter IPs and denies others outright;
// any failure here degrades to the synthetic tokenless path).
const STOOQ_HOSTS = ["https://stooq.com"];

async function fetchBinance(symbol: string): Promise<Candle[] | null> {
  for (const host of BINANCE_HOSTS) {
    try {
      const url = `${host}/api/v3/klines?symbol=${symbol}&interval=${INTERVAL}&limit=${LIMIT}`;
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (!res.ok) { console.error("[candles]", host, "HTTP", res.status); continue; }
      const rows = (await res.json()) as unknown[];
      if (!Array.isArray(rows)) continue;
      // Drop the in-progress candle (closeTime still in the future): only
      // CLOSED weekly candles shape the terrain, so the same symbol + UTC day
      // yields the exact same level no matter when it is fetched.
      const closed = rows.filter((r) => {
        const closeTime = Number((r as (string | number)[])?.[6]);
        return Number.isFinite(closeTime) && closeTime <= Date.now();
      });
      if (closed.length < 40) continue;
      return closed.map((r) => {
        const k = r as (string | number)[];
        return {
          t: Number(k[0]),
          o: Number(k[1]),
          h: Number(k[2]),
          l: Number(k[3]),
          c: Number(k[4]),
        };
      });
    } catch (err) {
      console.error("[candles]", host, "fetch failed:", (err as Error).message);
      continue;
    }
  }
  return null;
}

async function fetchStooq(symbol: string): Promise<Candle[] | null> {
  for (const host of STOOQ_HOSTS) {
    try {
      const url = `${host}/q/d/l/?s=${symbol.toLowerCase()}.us&i=w`;
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (!res.ok) { console.error("[candles/stooq]", host, "HTTP", res.status); continue; }
      const text = await res.text();
      const lines = text.trim().split("\n");
      if (lines[0]?.trim() !== "Date,Open,High,Low,Close,Volume") {
        // anti-bot challenge page or other unexpected payload — not CSV
        console.error("[candles/stooq]", host, "unexpected payload (challenge/blocked?)");
        continue;
      }
      const out: Candle[] = [];
      for (const line of lines.slice(1)) {
        const r = line.split(",");
        if (r.length < 5) continue;
        const t = Date.parse(`${r[0]}T00:00:00Z`);
        const o = Number(r[1]), h = Number(r[2]), l = Number(r[3]), c = Number(r[4]);
        if (!Number.isFinite(t) || ![o, h, l, c].every(Number.isFinite)) continue;
        // A weekly row closes 7 days after its date — drop the in-progress week
        // (same determinism rule as the crypto path: only CLOSED candles count).
        if (t + 7 * 86_400_000 > Date.now()) continue;
        out.push({ t, o, h, l, c });
      }
      if (out.length < 40) { console.error("[candles/stooq]", host, `only ${out.length} closed rows`); continue; }
      return out;
    } catch (err) {
      console.error("[candles/stooq]", host, "fetch failed:", (err as Error).message);
      continue;
    }
  }
  return null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  // Date-clamp (P0 follow-up): the server ALWAYS pins today — ?date= is not
  // honored, so no terrain (or run token) can ever be minted for a future date.
  const date = utcDateStr();

  // ?source=launch — vibe/vibe launch-of-the-day: derived terrain built from a
  // real launch's metrics, server-vouched with a run token. The value is
  // whitelisted to the single string "launch"; anything else is ignored.
  if (searchParams.get("source") === "launch") {
    try {
      const launch = await getLaunchOfDay(date);
      if (launch) {
        const symbol = launchSymbol(launch.symbol);
        const key = `vibe:${launch.launchId}:${symbol}|${date}`;
        let candles: Candle[];
        const hit = cache.get(key);
        if (hit && Date.now() - hit.ts < TTL) {
          candles = hit.candles;
        } else {
          candles = vibeLaunchCandles(launch, date);
          cache.set(key, { ts: Date.now(), candles, source: "vibe-launch" });
        }
        const data: CandleData = {
          seed: { date, symbol, interval: "derived", source: "vibe-launch" },
          candles,
        };
        data.runToken = signRunToken(symbol, date, candles.length, JSON.stringify(candles));
        return NextResponse.json(data, { headers: { "Cache-Control": "public, max-age=300" } });
      }
    } catch (err) {
      console.error("[candles/vibe-launch]", (err as Error).message);
    }
    // Launch-feed failure -> the daily synthetic tokenless path (same rule as
    // every other feed failure): unscored by construction.
  }

  // Honor ?symbol= when it is one of the whitelisted pairs (crypto rotation or
  // stock rails); otherwise the daily seeded rotation decides (default
  // behavior unchanged). Unknown symbols silently fall back to the daily pick.
  const requested = (searchParams.get("symbol") ?? "").toUpperCase();
  const symbol = WATCHLIST.includes(requested) || STOCKS.includes(requested)
    ? requested
    : pickSeed(date).symbol;
  const isStock = STOCKS.includes(symbol);

  const key = `${symbol}|${date}`;
  let source: Source = isStock ? "stooq" : "binance";
  let candles: Candle[] = [];

  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL) {
    candles = hit.candles;
    source = hit.source; // restore true source — a cached synthetic must stay synthetic (and tokenless)
  } else {
    const live = isStock ? await fetchStooq(symbol) : await fetchBinance(symbol);
    if (live) {
      candles = live;
    } else {
      candles = syntheticCandles(date, LIMIT);
      source = "synthetic";
    }
    cache.set(key, { ts: Date.now(), candles, source });
  }

  const data: CandleData = {
    seed: { date, symbol, interval: INTERVAL, source },
    candles,
  };
  // Run tokens are issued for every pinned non-synthetic terrain (binance,
  // stooq, vibe-launch); the synthetic fallback stays tokenless, and tokenless
  // runs are unscored client-side. The token lib is source-agnostic.
  if (source !== "synthetic") {
    data.runToken = signRunToken(symbol, date, candles.length, JSON.stringify(candles));
  }
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
