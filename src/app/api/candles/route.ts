// /api/candles — daily level data: seeded symbol rotation + Binance klines proxy.
// Level source logic (seed, watchlist, synthetic fallback) lives in
// src/game/cc/level-source.ts so the client can derive identical data offline.
// W1 integrity: ?symbol= is honored when whitelisted, the in-progress weekly
// candle is dropped (only CLOSED candles shape the terrain), and the response
// carries an HMAC runToken that pins symbol+date+terrain for the leaderboard.
import { NextResponse } from "next/server";
import { utcDateStr } from "@/game/cc/rng";
import { pickSeed, syntheticCandles, INTERVAL, LIMIT, WATCHLIST } from "@/game/cc/level-source";
import { signRunToken } from "@/lib/run-token";
import type { Candle, CandleData } from "@/game/cc/types";

interface CacheEntry { ts: number; candles: Candle[]; source: "binance" | "synthetic" }
const cache = new Map<string, CacheEntry>();
const TTL = 24 * 60 * 60 * 1000; // 24h — closed-candle terrain never changes within its UTC day

// Hosts are tried in order. api.binance.com geo-blocks some datacenter IPs
// (e.g. US-hosted serverless functions -> HTTP 451), so the official
// market-data mirror data-api.binance.vision is the second host.
const BINANCE_HOSTS = [
  "https://api.binance.com",
  "https://data-api.binance.vision",
];

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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get("date") ?? "")
    ? (searchParams.get("date") as string)
    : utcDateStr();

  // Honor ?symbol= when it is one of the client-rotation pairs; otherwise the
  // daily seeded rotation decides (default behavior unchanged).
  const requested = (searchParams.get("symbol") ?? "").toUpperCase();
  const symbol = WATCHLIST.includes(requested) ? requested : pickSeed(date).symbol;

  const key = `${symbol}|${date}`;
  let source: "binance" | "synthetic" = "binance";
  let candles: Candle[] = [];

  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL) {
    candles = hit.candles;
    source = hit.source; // restore true source — a cached synthetic must stay synthetic (and tokenless)
  } else {
    const live = await fetchBinance(symbol);
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
  // Run tokens are issued only for pinned real-market terrain; the synthetic
  // fallback stays tokenless, and tokenless runs are unscored client-side.
  if (source === "binance") {
    data.runToken = signRunToken(symbol, date, candles.length, JSON.stringify(candles));
  }
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
