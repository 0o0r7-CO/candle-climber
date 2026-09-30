// vibe/vibe launch-of-the-day — secondary level source (workstream W3, GAP §4-G2).
// Server-only: fetches the platform's real launch list, pins ONE launch per UTC
// date, and DERIVES playable terrain from that launch's real on-chain metrics.
//
// Honesty rules (non-negotiable):
// - The launches payload is REAL data (captured shape: research-cache/launches_ALL.json).
// - The candles are DERIVED from real launch metrics — never label them "live".
// - Failure degrades to the synthetic tokenless path (unscored by construction).
//
// Feed: GET https://testnet.vibevibe.fun/api/v1/chains/46630/v6/launches?limit=5
// (cursor API, max limit=5 — plenty for launch-of-the-day). Free, keyless.
// Documented in docs/FEEDS.md.
import { createHash } from "node:crypto";
import { hashString, mulberry32, utcDateStr } from "@/game/cc/rng";
import type { Candle } from "@/game/cc/types";

const LAUNCHES_URL =
  "https://testnet.vibevibe.fun/api/v1/chains/46630/v6/launches?limit=5";
const RAW_TTL_MS = 60 * 60 * 1000; // raw response cache: 1h, keyed by hour bucket
const MIN_CANDLES = 60;
const MAX_CANDLES = 219;

/** The exact fields this module uses — all verified present in the real payload. */
export interface VibeLaunch {
  launchId: string;
  symbol: string;
  createdAt: string; // ISO timestamp of the real on-chain launch
  graduated: boolean;
  holderCount: number; // market.holderCount
  volume24hPairUnits: string; // market.volume24hPairUnits (18-decimal units)
  buyCount24h: number; // market.buyCount24h
  sellCount24h: number; // market.sellCount24h
}

/* ---- raw response cache: 1h, keyed by UTC hour bucket (spec §2a) ---- */
let rawCache: { bucket: number; items: VibeLaunch[] } | null = null;

function hourBucket(now: number): number {
  return Math.floor(now / 3_600_000);
}

function extractItems(payload: unknown): VibeLaunch[] {
  const items = (payload as { data?: { items?: unknown[] } })?.data?.items;
  if (!Array.isArray(items)) return [];
  const out: VibeLaunch[] = [];
  for (const it of items) {
    const o = it as Record<string, unknown>;
    const market = o.market as Record<string, unknown> | undefined;
    // defensive: only keep items whose fields we actually use exist and are sane
    if (
      typeof o.launchId === "string" && o.launchId &&
      typeof o.symbol === "string" && o.symbol &&
      typeof o.createdAt === "string" && Number.isFinite(Date.parse(o.createdAt)) &&
      typeof o.graduated === "boolean" &&
      market &&
      typeof market.volume24hPairUnits === "string" &&
      typeof market.holderCount === "number" &&
      typeof market.buyCount24h === "number" &&
      typeof market.sellCount24h === "number"
    ) {
      out.push({
        launchId: o.launchId,
        symbol: o.symbol,
        createdAt: o.createdAt,
        graduated: o.graduated,
        holderCount: market.holderCount,
        volume24hPairUnits: market.volume24hPairUnits,
        buyCount24h: market.buyCount24h,
        sellCount24h: market.sellCount24h,
      });
    }
  }
  return out;
}

async function fetchLaunches(): Promise<VibeLaunch[] | null> {
  const bucket = hourBucket(Date.now());
  if (rawCache && rawCache.bucket === bucket) return rawCache.items;
  try {
    const res = await fetch(LAUNCHES_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("[vibe-launch] HTTP", res.status);
      return null;
    }
    const items = extractItems(await res.json());
    if (items.length === 0) {
      console.error("[vibe-launch] empty/invalid launches payload");
      return null;
    }
    rawCache = { bucket, items };
    return items;
  } catch (err) {
    console.error("[vibe-launch] fetch failed:", (err as Error).message);
    return null;
  }
}

/* ---- launch-of-the-day: pinned once per UTC date so the terrain cannot
 * change mid-day when newer launches push the top-5 forward ---- */
const dayCache = new Map<string, { expires: number; launch: VibeLaunch }>();

// Pick rule (documented): idx = sha256(utcDate) mod items.length over the
// API's newest-5 list (CREATED_DESC). First success of the day wins the pin.
function pickLaunchOfDay(items: VibeLaunch[], date: string): VibeLaunch {
  const digest = createHash("sha256").update(date).digest();
  // BigInt math (no literals: tsconfig targets < ES2020) for an exact
  // sha256(utcDate) mod items.length — the documented pick rule.
  let v = BigInt(0);
  for (const b of digest.subarray(0, 8)) v = v * BigInt(256) + BigInt(b);
  return items[Number(v % BigInt(items.length))];
}

export async function getLaunchOfDay(date: string): Promise<VibeLaunch | null> {
  const hit = dayCache.get(date);
  if (hit && Date.now() < hit.expires) return hit.launch;
  const items = await fetchLaunches();
  if (!items || items.length === 0) return null;
  const launch = pickLaunchOfDay(items, date);
  dayCache.set(date, { launch, expires: Date.parse(date + "T00:00:00Z") + 86_400_000 });
  if (dayCache.size > 10) {
    const cutoff = utcDateStr();
    for (const k of dayCache.keys()) if (k < cutoff) dayCache.delete(k);
  }
  return launch;
}

/** Ticker sanitize: uppercase, strip non-alphanumerics, max 10 chars, fallback. */
export function launchSymbol(raw: string): string {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
  return s || "VIBELAUNCH";
}

/* ---- derived terrain ----
 * Mapping (documented; deterministic in (launch, date) only — no Date.now()):
 *
 * count    = clamp(60, 60 + floor(ageDays), 219)          — the launch's REAL age
 *            at the level date shapes the level length.
 * vol24    = Number(volume24hPairUnits) / 1e18            — real 24h pair volume.
 * volScore = clamp01(log10(1 + vol24) / 6)                — 1e6 pair units/day -> ~1.
 * holdScore= clamp01(log2(1 + holderCount) / 8)           — 256 holders -> 1.
 * dirBias  = (buyCount24h - sellCount24h) / (buys+sells), clamped to [-1, 1]
 *                                                           — real 24h flow sets drift.
 * baseDrift= dirBias * (0.004 + 0.02 * volScore) * (graduated ? 1.5 : 1)
 * noise    = 0.06 - 0.03 * holdScore                      — deeper holder base -> calmer path.
 *
 * Micro-structure (wicks, regime shifts every ~20 candles) comes from
 * mulberry32(hashString("cc-vibe-v1:" + launchId + ":" + date)). Prices are
 * ABSTRACT units anchored at 100 (like the synthetic fallback) — the real
 * metrics shape drift/volatility/length/character, they are not fake OHLC.
 */
export function vibeLaunchCandles(launch: VibeLaunch, date: string): Candle[] {
  const createdAtMs = Date.parse(launch.createdAt);
  const dayMs = Date.parse(date + "T00:00:00Z");
  const ageDays = Math.max(0, (dayMs - createdAtMs) / 86_400_000);
  const count = Math.min(MAX_CANDLES, Math.max(MIN_CANDLES, MIN_CANDLES + Math.floor(ageDays)));

  const vol24 = Number(launch.volume24hPairUnits) / 1e18; // 18-decimal unit strings
  const volScore = Math.min(1, Math.max(0, Math.log10(1 + vol24) / 6));
  const holdScore = Math.min(1, Math.max(0, Math.log2(1 + launch.holderCount) / 8));
  const trades = launch.buyCount24h + launch.sellCount24h;
  const dirBias = trades > 0
    ? Math.min(1, Math.max(-1, (launch.buyCount24h - launch.sellCount24h) / trades))
    : 0;

  const baseDrift = dirBias * (0.004 + 0.02 * volScore) * (launch.graduated ? 1.5 : 1);
  const noise = 0.06 - 0.03 * holdScore;

  const rnd = mulberry32(hashString("cc-vibe-v1:" + launch.launchId + ":" + date));
  const out: Candle[] = [];
  let price = 100;
  let segment = 0;
  let t = dayMs - count * 7 * 86_400_000;
  for (let i = 0; i < count; i++) {
    if (i % 20 === 19) segment = (rnd() - 0.5) * 0.04; // regime shift
    const o = price;
    const move = segment + baseDrift + (rnd() - 0.5) * noise;
    const c = Math.max(1, o * (1 + move));
    const wick = Math.abs(move) * (0.4 + rnd()) + rnd() * 0.01;
    const h = Math.max(o, c) * (1 + wick);
    const l = Math.min(o, c) * (1 - wick);
    out.push({ t: t + i * 7 * 86_400_000, o, h, l, c });
    price = c;
  }
  return out;
}
