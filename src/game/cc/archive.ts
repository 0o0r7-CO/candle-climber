// H1 ARCHIVE — "our levels are documentary, not designed" (P2.2).
// PURE module: no fetch, no Date.now(), no Math.random(). Every function takes
// its clock as an argument so W5 can pin determinism byte-for-byte.
//
// What the archive is: the deterministic level generator already takes
// (symbol, date) — the archive simply lets players aim it at PAST UTC dates.
// Famous days (COVID crash, LUNA, FTX) become famous levels nobody would dare
// design by hand. Era palettes land with V1/V3 (ART-DIRECTION §4); this file
// is the mechanics spine: validation, clamping, difficulty auto-tagging.
//
// Archive runs are PRACTICE: the W1 run-token staleness rule (isTokenStale)
// still binds the leaderboard, and the client suppresses submission for
// archive terrain. No anti-cheat surface is touched — see docs/GROWTH-AND-
// HOOKS-STRATEGY §6 H1 and MASTER-CHECKLIST P2.2.
import type { Candle } from "./types";
import { WATCHLIST, pickSeed } from "./level-source";

export const WEEK_MS = 7 * 86_400_000;

// Binance spot history starts mid-2017; anything older falls back to the
// (tokenless, unscored) synthetic path via the <40-closed-candle guard.
export const ARCHIVE_MIN_DATE = "2017-01-01";

export type DifficultyTag = "CALM" | "ROCKY" | "BRUTAL" | "LEGENDARY";

export interface EraDef {
  id: string;
  date: string; // UTC YYYY-MM-DD — the level date the era deep-links to
  symbol: string; // must be whitelisted (ALL_SYMBOLS)
  name: string; // the history books' name for the day
  blurb: string; // one honest line of context
}

// Curated famous days. Labels describe what actually happened that week —
// the tags shown next to them are COMPUTED (archiveTag), never hand-assigned.
// LEVEL DATE = the Monday the story-week CLOSED: only closed candles shape
// terrain (W1 invariant), so pointing an era at the famous INTRA-week day
// would drop the very candle that made it famous. With the post-close date,
// the famous week IS the final candle the player ends on.
export const ERAS: EraDef[] = [
  {
    id: "covid-crash",
    date: "2020-03-16",
    symbol: "BTCUSDT",
    name: "COVID CRASH",
    blurb: "the week BTC fell ~40% in hours. nobody designed this.",
  },
  {
    id: "snl-top",
    date: "2021-05-10",
    symbol: "DOGEUSDT",
    name: "SNL TOP",
    blurb: "the week a joke became the mountain.",
  },
  {
    id: "may-flash-crash",
    date: "2021-05-24",
    symbol: "BTCUSDT",
    name: "MAY FLASH CRASH",
    blurb: "the week altcoins fell half their height before breakfast.",
  },
  {
    id: "luna-collapse",
    date: "2022-05-16",
    symbol: "BTCUSDT",
    name: "LUNA COLLAPSE",
    blurb: "the week a stablecoin dissolved; the terrain went with it.",
  },
  {
    id: "ftx-collapse",
    date: "2022-11-14",
    symbol: "BTCUSDT",
    name: "FTX COLLAPSE",
    blurb: "the exchange week that broke the floor.",
  },
  {
    id: "the-peak",
    date: "2021-11-15",
    symbol: "BTCUSDT",
    name: "THE PEAK",
    blurb: "the all-time-high week. climb what euphoria built.",
  },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True when `s` is a well-formed UTC date, on/before today, and not older
 *  than ARCHIVE_MIN_DATE. `today` is injected (UTC YYYY-MM-DD) for purity. */
export function isArchiveDate(s: unknown, today: string): boolean {
  if (typeof s !== "string" || !DATE_RE.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  if (!Number.isFinite(t)) return false;
  if (s > today) return false; // future terrain is forbidden (W1: server pins dates)
  if (s >= today) return false; // today IS the daily level, not archive
  return s >= ARCHIVE_MIN_DATE;
}

/** Last millisecond of a UTC day (inclusive end for closed-candle filters). */
export function endOfDayMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) + 86_400_000 - 1;
}

/**
 * Keep only candles CLOSED by the end of `date` — a weekly candle that opens
 * before the archive date but closes after it was still in progress on that
 * day and must not shape the terrain. Pure: input is never mutated.
 */
export function clampCandlesTo(candles: Candle[], date: string): Candle[] {
  const end = endOfDayMs(date);
  return candles.filter((c) => c.t + WEEK_MS <= end);
}

// ---- Difficulty auto-tag (the archive's honest danger label) ----
// Computed from the TAIL of the clamped series — the stretch the player will
// actually end on. Thresholds are fixed constants so the same terrain always
// tags identically (W5 pins this). Precedence: LEGENDARY > BRUTAL > CALM > ROCKY.
const TAG_TAIL = 8; // last N candles examined
const LEGENDARY_WORST = -0.18; // single weekly body ≤ -18%
const LEGENDARY_RANGE = 0.45; // single weekly range ≥ 45% of open
const BRUTAL_WORST = -0.1;
const BRUTAL_RANGE = 0.28;
const CALM_BODY = 0.025;
const CALM_RANGE = 0.14;

export function archiveTag(candles: Candle[]): DifficultyTag {
  if (!candles || candles.length === 0) return "ROCKY";
  const tail = candles.slice(Math.max(0, candles.length - TAG_TAIL));
  let worst = 0;
  let maxRange = 0;
  let bodySum = 0;
  for (const c of tail) {
    const o = Math.abs(c.o) || 1;
    const body = (c.c - c.o) / o;
    if (body < worst) worst = body;
    const range = (c.h - c.l) / o;
    if (range > maxRange) maxRange = range;
    bodySum += Math.abs(body);
  }
  const avgBody = bodySum / tail.length;
  if (worst <= LEGENDARY_WORST || maxRange >= LEGENDARY_RANGE) return "LEGENDARY";
  if (worst <= BRUTAL_WORST || maxRange >= BRUTAL_RANGE) return "BRUTAL";
  if (avgBody < CALM_BODY && maxRange < CALM_RANGE) return "CALM";
  return "ROCKY";
}

// ---- Recent daily levels ----
export interface ArchiveRow {
  date: string;
  symbol: string;
}

/** The last `n` daily levels before `today` (exclusive): each past date's
 *  seeded rotation symbol — identical to what the server serves for
 *  `?date=<that day>` with no symbol. Pure (clock injected). */
export function recentDailies(today: string, n = 10): ArchiveRow[] {
  const out: ArchiveRow[] = [];
  const t = Date.parse(`${today}T00:00:00Z`);
  for (let k = 1; k <= n; k++) {
    const date = new Date(t - k * 86_400_000).toISOString().slice(0, 10);
    out.push({ date, symbol: pickSeed(date).symbol });
  }
  return out;
}

// ---- Deep links ----
export interface ArchiveLinkParams {
  symbol: string;
  date: string;
  renderer?: string; // carried through so A/B testing survives navigation
}

/** Build a relative deep link to an archive level. Whitelist-checked:
 *  unknown symbols or non-archive dates yield plain "/" instead of a
 *  tampered URL. `today` is injected (UTC YYYY-MM-DD) for purity. */
export function archiveHref(p: ArchiveLinkParams, today: string): string {
  if (!WATCHLIST.includes(p.symbol) || !isArchiveDate(p.date, today)) {
    return "/";
  }
  const q = new URLSearchParams({ symbol: p.symbol, date: p.date });
  if (p.renderer === "v2") q.set("renderer", "v2"); // whitelisted single value
  const qs = q.toString();
  return `/?${qs}`;
}

// ---- Wire helpers shared by /api/candles (kept pure for W5) ----

/** Binance klines URL pinned to end exactly at `endMs` (archive) — the
 *  today-path passes no endMs and stays byte-identical to pre-archive. */
export function binanceKlinesUrl(host: string, symbol: string, interval: string, limit: number, endMs?: number): string {
  const base = `${host}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  return endMs === undefined ? base : `${base}&endTime=${endMs}`;
}
