// Leaderboard POST validation — PURE decision core (W5).
// Extracted mechanically from /api/leaderboard (W1) so
// test/leaderboard-contract.test.ts can pin the anti-cheat contract. The route
// keeps transport concerns (per-IP rate limit, run-token verification +
// staleness, storage) and hands this function the VERIFIED token payload —
// client-claimed symbol/date can never reach a stored entry.
import type { BoardEntry } from "@/lib/leaderboard-store";
import type { RunTokenPayload } from "@/lib/run-token";
// W4: engine max gain = 10 base (20 post-grad world 2) × combo cap (1 + 12*0.5)
// = 7 → 70 / 140. Shared with the engine via src/lib/scoring.ts and coupled by
// test/summit.test.ts.
import { MAX_SCORE_PER_CANDLE } from "@/lib/scoring";

// world 2 extends the terrain indefinitely (W4); 5000 closed candles ≈ a
// 20+ minute run — the score caps below remain the real anti-cheat gates.
export const MAX_CANDLES = 5000;

export type SubmissionVerdict =
  | { ok: true; entry: BoardEntry }
  | { ok: false; error: string; status: number };

export function sanitizeName(raw: unknown): string {
  const s = String(raw ?? "")
    // strip control chars + angle brackets, keep it plain-text
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .trim()
    .slice(0, 14);
  return s || "ANON";
}

/**
 * Validate a submission body against the already-verified token payload.
 * Same checks, same order, same error strings/statuses as the original
 * route logic (W1), byte-for-byte — this is a mechanical move only.
 * `now` defaults to Date.now() and is injectable for tests.
 */
export function validateSubmission(
  body: Partial<BoardEntry> & { runToken?: unknown },
  tok: RunTokenPayload,
  now: number = Date.now(),
): SubmissionVerdict {
  const entry: BoardEntry = {
    name: sanitizeName(body.name),
    score: Math.floor(Number(body.score ?? 0)),
    candlesPassed: Math.floor(Number(body.candlesPassed ?? 0)),
    bestStreak: Math.max(0, Math.min(999, Math.floor(Number(body.bestStreak ?? 0)))),
    mutation: String(body.mutation ?? "").slice(0, 24) || undefined,
    // pinned exclusively from the verified token payload — client-claimed
    // symbol/date are ignored
    symbol: tok.symbol,
    date: tok.date,
    ts: now,
  };

  // shape validation
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
    return { ok: false, error: "invalid date", status: 400 };
  }
  if (!Number.isFinite(entry.score) || entry.score < 0 || entry.score > 10_000_000) {
    return { ok: false, error: "invalid score", status: 400 };
  }
  if (!Number.isFinite(entry.candlesPassed) || entry.candlesPassed < 0 || entry.candlesPassed > MAX_CANDLES) {
    return { ok: false, error: "invalid candles", status: 400 };
  }
  // anti-cheat: terrain-imposed physical caps (count comes from the token)
  if (
    entry.candlesPassed > tok.count * MAX_SCORE_PER_CANDLE ||
    entry.score > tok.count * MAX_SCORE_PER_CANDLE + 20
  ) {
    return { ok: false, error: "score exceeds physical maximum", status: 403 };
  }
  // anti-cheat: score must be physically reachable from candles passed
  if (entry.score > entry.candlesPassed * MAX_SCORE_PER_CANDLE + 20) {
    return { ok: false, error: "score inconsistent with run", status: 400 };
  }

  return { ok: true, entry };
}
