// /api/candles — daily level data: seeded symbol rotation + Binance klines proxy.
// Level source logic (seed, watchlist, synthetic fallback) lives in
// src/game/cc/level-source.ts so the client can derive identical data offline.
import { NextResponse } from "next/server";
import { utcDateStr } from "@/game/cc/rng";
import { pickSeed, syntheticCandles, INTERVAL, LIMIT } from "@/game/cc/level-source";
import type { Candle, CandleData } from "@/game/cc/types";

interface CacheEntry { ts: number; candles: Candle[] }
const cache = new Map<string, CacheEntry>();
const TTL = 60 * 60 * 1000; // 1h

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
      if (!res.ok) continue;
      const rows = (await res.json()) as unknown[];
      if (!Array.isArray(rows) || rows.length < 40) continue;
      return rows.map((r) => {
        const k = r as (string | number)[];
        return {
          t: Number(k[0]),
          o: Number(k[1]),
          h: Number(k[2]),
          l: Number(k[3]),
          c: Number(k[4]),
        };
      });
    } catch {
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

  const { symbol } = pickSeed(date);
  const key = `${symbol}:${date}`;
  let source: "binance" | "synthetic" = "binance";
  let candles: Candle[] = [];

  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL) {
    candles = hit.candles;
  } else {
    const live = await fetchBinance(symbol);
    if (live) {
      candles = live;
      cache.set(key, { ts: Date.now(), candles: live });
    } else {
      candles = syntheticCandles(date, LIMIT);
      source = "synthetic";
      cache.set(key, { ts: Date.now(), candles });
    }
  }

  const data: CandleData = {
    seed: { date, symbol, interval: INTERVAL, source },
    candles,
  };
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
