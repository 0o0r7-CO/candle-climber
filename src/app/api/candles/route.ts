// /api/candles — daily level data: seeded symbol rotation + market-data proxies.
// Level source logic (seed, watchlist, synthetic fallback) lives in
// src/game/cc/level-source.ts so the client can derive identical data offline.
// W1 integrity: ?symbol= is honored when whitelisted, the in-progress weekly
// candle is dropped (only CLOSED candles shape the terrain), and the response
// carries an HMAC runToken that pins symbol+date+terrain for the leaderboard.
// W3 rails: stock pairs via stooq weekly CSV (?symbol=TSLA|AMZN|NFLX) and the
// vibe/vibe launch-of-the-day as a derived secondary source (?source=launch).
// The server ALWAYS pins today as the default (utcDateStr) — but P2.2 (H1
// ARCHIVE) additionally honors ?date= for PAST UTC dates only: famous history
// becomes playable terrain. Future or malformed dates are ignored outright
// (the W1 no-future-terrain guarantee is absolute). Archive terrain is
// clamped to closed candles by the end of that day, so a run token minted for
// an archive date pins an immutable terrain; the leaderboard's staleness
// rule keeps such tokens unscoreable, and the client plays archive as
// PRACTICE (no submission) — see src/game/cc/archive.ts.
import { NextResponse } from "next/server";
import { utcDateStr } from "@/game/cc/rng";
import { pickSeed, syntheticCandles, INTERVAL, LIMIT, WATCHLIST, STOCKS, isInterval } from "@/game/cc/level-source";
import { isArchiveDate, endOfDayMs, clampCandlesTo, binanceKlinesUrl } from "@/game/cc/archive";
import { signRunToken } from "@/lib/run-token";
import { parseStooqCsv } from "@/lib/stooq";
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

async function fetchBinance(symbol: string, interval: string, endMs?: number): Promise<Candle[] | null> {
  for (const host of BINANCE_HOSTS) {
    try {
      // archive mode pins endTime so the window ENDS at the archive day;
      // today-path passes no endMs. P3.5: interval flows through (1w/1d/4h/1h).
      const url = binanceKlinesUrl(host, symbol, interval, LIMIT, endMs);
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (!res.ok) { console.error("[candles]", host, "HTTP", res.status); continue; }
      const rows = (await res.json()) as unknown[];
      if (!Array.isArray(rows)) continue;
      // Drop the in-progress candle (closeTime still in the future): only
      // CLOSED weekly candles shape the terrain, so the same symbol + UTC day
      // yields the exact same level no matter when it is fetched.
      const closed = rows.filter((r) => {
        const closeTime = Number((r as (string | number)[])?.[6]);
        return Number.isFinite(closeTime) && closeTime <= (endMs ?? Date.now());
      });
      if (closed.length < 40) continue;
      return closed.map((r) => {
        const k = r as (string | number)[];
        const vol = Number(k[5]);
        return {
          t: Number(k[0]),
          o: Number(k[1]),
          h: Number(k[2]),
          l: Number(k[3]),
          c: Number(k[4]),
          // volume feeds the H2 weather fog (P2.3); 0/NaN -> omitted
          ...(Number.isFinite(vol) && vol > 0 ? { v: vol } : {}),
        };
      });
    } catch (err) {
      console.error("[candles]", host, "fetch failed:", (err as Error).message);
      continue;
    }
  }
  return null;
}

async function fetchStooq(symbol: string, clamp?: (rows: Candle[]) => Candle[]): Promise<Candle[] | null> {
  for (const host of STOOQ_HOSTS) {
    try {
      const url = `${host}/q/d/l/?s=${symbol.toLowerCase()}.us&i=w`;
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (!res.ok) { console.error("[candles/stooq]", host, "HTTP", res.status); continue; }
      const text = await res.text();
      // Pure parser (W5 extraction — src/lib/stooq.ts, contract pinned by
      // test/feeds.test.ts): null = challenge/HTML payload OR <40 closed rows.
      const parsed = parseStooqCsv(text, Date.now());
      if (!parsed) {
        console.error("[candles/stooq]", host, "unusable payload (challenge/blocked?) or <40 closed rows");
        continue;
      }
      // Archive mode clamps the full history to closed-by-that-day rows; if
      // the clamped window is too thin, the synthetic path takes over.
      const clamped = clamp ? clamp(parsed) : parsed;
      if (clamped.length < 40) {
        console.error("[candles/stooq]", host, "<40 rows closed by archive date");
        continue;
      }
      return clamped;
    } catch (err) {
      console.error("[candles/stooq]", host, "fetch failed:", (err as Error).message);
      continue;
    }
  }
  return null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  // Date-clamp (P0 follow-up, extended by P2.2): the server pins today unless
  // ?date= names a strictly PAST, well-formed UTC date (H1 ARCHIVE). Future or
  // malformed ?date= values are ignored — no terrain (or run token) can ever
  // be minted for a future date.
  const today = utcDateStr();
  const requestedDate = searchParams.get("date");
  const isArchive = isArchiveDate(requestedDate, today);
  const date = isArchive ? (requestedDate as string) : today;

  // ?source=launch — vibe/vibe launch-of-the-day: derived terrain built from a
  // real launch's metrics, server-vouched with a run token. The value is
  // whitelisted to the single string "launch"; anything else is ignored.
  // (Launch-of-the-day is a TODAY concept — an archive ?date= takes priority
  // and the launch source is skipped.)
  if (!isArchive && searchParams.get("source") === "launch") {
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
  // stock rails); otherwise the daily seeded rotation decides for the level
  // date — for an archive date that is THAT day's rotation symbol, so the
  // archive browser can list past dailies without any server allow-list.
  const requested = (searchParams.get("symbol") ?? "").toUpperCase();
  const symbol = WATCHLIST.includes(requested) || STOCKS.includes(requested)
    ? requested
    : pickSeed(date).symbol;
  const isStock = STOCKS.includes(symbol);

  // P3.5 timeframe selector: ?interval= is whitelist-checked; the classic
  // weekly level stays the default. ARCHIVE stays daily-only in V1 (the
  // archive pipeline is weekly-shaped by design) and STOCK rails have no
  // intraday feed — both honestly pin "1w" and echo it in seed.interval.
  const requestedInterval = searchParams.get("interval");
  const interval = !isArchive && !isStock && isInterval(requestedInterval) ? requestedInterval : INTERVAL;

  const key = `${symbol}|${date}|${interval}`;
  let source: Source = isStock ? "stooq" : "binance";
  let candles: Candle[] = [];

  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL) {
    candles = hit.candles;
    source = hit.source; // restore true source — a cached synthetic must stay synthetic (and tokenless)
  } else {
    // Archive mode ends every fetch window at the end of the archive day:
    // binance via endTime, stooq by clamping the parsed full history.
    const endMs = isArchive ? endOfDayMs(date) : undefined;
    const live = isStock
      ? (await fetchStooq(symbol, (rows) => (isArchive ? clampCandlesTo(rows, date) : rows)))
      : await fetchBinance(symbol, interval, endMs);
    if (live) {
      candles = live;
    } else {
      candles = syntheticCandles(date, LIMIT, interval);
      source = "synthetic";
    }
    cache.set(key, { ts: Date.now(), candles, source });
  }

  const data: CandleData = {
    seed: { date, symbol, interval, source },
    candles,
  };
  // Run tokens are issued for every pinned non-synthetic terrain (binance,
  // stooq, vibe-launch); the synthetic fallback stays tokenless, and tokenless
  // runs are unscored client-side. The token lib is source-agnostic. P3.5:
  // the token binds the timeframe, so per-tf boards stay server-authoritative.
  if (source !== "synthetic") {
    data.runToken = signRunToken(symbol, date, candles.length, JSON.stringify(candles), interval);
  }
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
