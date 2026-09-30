// Stooq weekly-CSV parser (W5): PURE module — no fetch, no Date.now().
// Extracted mechanically from /api/candles (W3 fetchStooq) so test/feeds.test.ts
// can pin the exact wire-format contract. The fetch wrapper (hosts, timeout,
// error logging) stays in the route; this function only decides whether a
// response BODY is a usable stooq CSV.
//
// Wire contract (docs/FEEDS.md): stooq.com/q/d/l/?s=<sym>.us&i=w returns
//   Date,Open,High,Low,Close,Volume
//   2024-01-01,248.4,250.1,247.6,249.9,51234500
//   ...one row per calendar week. Anti-bot responses are HTML challenge pages,
//   never CSV — those must parse as null, not throw.
import type { Candle } from "@/game/cc/types";

export const STOOQ_CSV_HEADER = "Date,Open,High,Low,Close,Volume";
export const MIN_CLOSED_ROWS = 40;

/**
 * Parse a stooq weekly CSV body into CLOSED candles, or null when the payload
 * is not usable: a challenge/HTML page, a wrong header, or fewer than
 * MIN_CLOSED_ROWS closed rows. Malformed rows are skipped.
 *
 * `now` is the caller's clock in ms so the module stays pure and testable —
 * the in-progress week (row date + 7d > now) is dropped, keeping the terrain
 * deterministic within its UTC day.
 */
export function parseStooqCsv(text: string, now: number): Candle[] | null {
  const lines = text.trim().split("\n");
  if (lines[0]?.trim() !== STOOQ_CSV_HEADER) {
    // anti-bot challenge page or other unexpected payload — not CSV
    return null;
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
    if (t + 7 * 86_400_000 > now) continue;
    out.push({ t, o, h, l, c });
  }
  if (out.length < MIN_CLOSED_ROWS) return null;
  return out;
}
