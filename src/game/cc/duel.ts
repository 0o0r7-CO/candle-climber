// P7.3 async duels — PURE core (challenge validation, verdict, tally, links).
//
// A duel is a challenge record created from a COMPLETED run: the challenger's
// score/candles + their position stream (same shape as a P7.2 ghost, so the
// accept side replays the exact climb they must beat). The challenged player
// opens the deep link (?duel=CODE), which pins the SAME symbol+date+interval
// terrain (buildPlatforms is byte-deterministic per (candles, seed)) and races
// the recorded stream. Winner = higher score; tie broken by candles; full tie
// = draw.
//
// INTEGRITY POSTURE (mirrors P7.2, W5 untouched):
// - Creation requires the HMAC run-token (issued by /api/candles) and terrain
//   is pinned EXCLUSIVELY from the verified payload — identical layering to
//   the leaderboard and ghosts.
// - The challenger's claimed score is sanity-capped with the SAME physical
//   formulas as validateSubmission (terrain-imposed maxima from the token's
//   candle count), but a duel verdict is SOCIAL truth, not leaderboard truth:
//   it never touches ranks/scores. The challenged player's own submission
//   still flows through W5 exactly as before.
// - Duel outcomes are tallied LOCALLY (no server identity exists to own a
//   record honestly); the store keeps challenges, not results.
// Zero network inside this module (pinned by test/duel.test.ts).
import { MAX_SCORE_PER_CANDLE } from "@/lib/scoring";
import {
  MAX_GHOST_SAMPLES, GHOST_X_MAX, GHOST_Y_MIN, GHOST_Y_MAX, type GhostEntry,
} from "./ghost";

/** Challenge codes live 7 days — a daily terrain's duel is worthless once the
 *  board rotates (same TTL policy as ghosts). Enforced by the store. */
export const DUEL_TTL_DAYS = 7;
/** Short shareable code: 6 unambiguous chars (no 0/O/1/I/L). */
export const DUEL_CODE_LEN = 6;
export const DUEL_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
/** Client-trusted code shape — the store is the only authority on existence. */
export const DUEL_CODE_RE = new RegExp(`^[${DUEL_CODE_ALPHABET}]{${DUEL_CODE_LEN}}$`);
/** Score cap mirrors validateSubmission's hard ceiling. */
export const DUEL_SCORE_MAX = 10_000_000;

export interface DuelChallenge {
  code: string;
  name: string;
  charId: string;
  score: number;
  candlesPassed: number;
  bestStreak: number;
  symbol: string;
  date: string;
  interval: string;
  ts: number;
  /** Challenger's position stream — identical contract to a ghost's. */
  samples: number[];
}

export type DuelVerdict =
  | { ok: true; challenge: DuelChallenge }
  | { ok: false; error: string; status: number };

/**
 * Validate a duel-create POST body against the already-verified token payload.
 * Pure — same layering as validateSubmission/validateGhost: the route hands
 * over the VERIFIED token payload; client-claimed symbol/date/interval are
 * ignored. `maxCandles` is injected (route owns MAX_CANDLES) for parity with
 * validateGhost.
 */
export function validateDuelChallenge(
  body: Record<string, unknown>,
  tok: { symbol: string; date: string; interval: string; count: number },
  maxCandles: number,
  now: number = Date.now(),
): DuelVerdict {
  // samples: exact same physical contract as a ghost (replayable proof)
  const raw = body.samples;
  if (!Array.isArray(raw)) return { ok: false, error: "invalid samples", status: 400 };
  if (raw.length === 0) return { ok: false, error: "empty samples", status: 400 };
  if (raw.length % 2 !== 0) return { ok: false, error: "invalid samples", status: 400 };
  if (raw.length > MAX_GHOST_SAMPLES * 2) {
    return { ok: false, error: "samples exceed cap", status: 400 };
  }
  const samples: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    const v = Number(raw[i]);
    if (!Number.isFinite(v)) return { ok: false, error: "invalid sample", status: 400 };
    const r = Math.round(v);
    if (r !== v) return { ok: false, error: "samples must be integers", status: 400 };
    if (i % 2 === 0) {
      if (r < 0 || r > GHOST_X_MAX) return { ok: false, error: "sample out of bounds", status: 400 };
    } else {
      if (r < GHOST_Y_MIN || r > GHOST_Y_MAX) return { ok: false, error: "sample out of bounds", status: 400 };
    }
    samples.push(r);
  }

  const score = Math.floor(Number(body.score ?? 0));
  if (!Number.isFinite(score) || score < 0 || score > DUEL_SCORE_MAX) {
    return { ok: false, error: "invalid score", status: 400 };
  }
  const candlesPassed = Math.floor(Number(body.candlesPassed ?? 0));
  if (!Number.isFinite(candlesPassed) || candlesPassed < 0 || candlesPassed > maxCandles) {
    return { ok: false, error: "invalid candles", status: 400 };
  }
  // physical sanity (same formulas as validateSubmission, token-count based):
  // a claimed run cannot exceed what this terrain's candle count can pay out
  if (candlesPassed > tok.count * MAX_SCORE_PER_CANDLE || score > tok.count * MAX_SCORE_PER_CANDLE + 20) {
    return { ok: false, error: "score exceeds physical maximum", status: 403 };
  }
  // the recorded stream cannot express more candles than it has horizon for
  if (candlesPassed > samples.length / 2) {
    return { ok: false, error: "candles exceed recorded horizon", status: 400 };
  }

  const charId = typeof body.charId === "string" && body.charId.length <= 24 && /^[a-z0-9-]+$/i.test(body.charId)
    ? body.charId
    : "default";

  return {
    ok: true,
    challenge: {
      code: "", // assigned by the store on create
      name: String(body.name ?? "ANON").replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, 14) || "ANON",
      charId,
      score,
      candlesPassed,
      bestStreak: Math.max(0, Math.min(999, Math.floor(Number(body.bestStreak ?? 0)))),
      symbol: tok.symbol,
      date: tok.date,
      interval: tok.interval,
      ts: now,
      samples,
    },
  };
}

/* --------------------------------- verdict --------------------------------- */

export type DuelOutcome = "win" | "loss" | "draw";
export interface DuelTarget {
  name: string;
  score: number;
  candlesPassed: number;
}

/**
 * Winner verdict — score first (the number the death card brags), candles as
 * the tie-break, full tie = draw. Deterministic and pure: both players climbed
 * the SAME byte-identical terrain, so the comparison is apples-to-apples.
 */
export function duelVerdict(
  target: DuelTarget,
  mine: { score: number; candlesPassed: number },
): { outcome: DuelOutcome; line: string } {
  if (mine.score > target.score) {
    return { outcome: "win", line: `DUEL WON — ${target.name} dethroned` };
  }
  if (mine.score < target.score) {
    return { outcome: "loss", line: `DUEL LOST — ${target.name} holds the chart` };
  }
  if (mine.candlesPassed > target.candlesPassed) {
    return { outcome: "win", line: `DUEL WON — same score, higher climb` };
  }
  if (mine.candlesPassed < target.candlesPassed) {
    return { outcome: "loss", line: `DUEL LOST — same score, lower climb` };
  }
  return { outcome: "draw", line: `DUEL DRAW — ${target.name} ties the chart` };
}

/* ------------------------------ local tally -------------------------------- */

export interface DuelTally {
  w: number;
  l: number;
  d: number;
}

export const EMPTY_TALLY: DuelTally = { w: 0, l: 0, d: 0 };

/** Pure tally fold — the component owns persistence (localStorage). */
export function applyDuelResult(t: DuelTally, outcome: DuelOutcome): DuelTally {
  if (outcome === "win") return { w: t.w + 1, l: t.l, d: t.d };
  if (outcome === "loss") return { w: t.w, l: t.l + 1, d: t.d };
  return { w: t.w, l: t.l, d: t.d + 1 };
}

/** Accept only well-formed tallies from storage; anything else resets. */
export function parseTally(raw: string | null): DuelTally {
  if (!raw) return { ...EMPTY_TALLY };
  try {
    const o = JSON.parse(raw) as Partial<DuelTally>;
    const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    return { w: n(o.w), l: n(o.l), d: n(o.d) };
  } catch {
    return { ...EMPTY_TALLY };
  }
}

export function tallyLabel(t: DuelTally): string {
  return `${t.w}–${t.l}–${t.d}`;
}

/* ------------------------------ replay + links ----------------------------- */

/**
 * A duel challenge IS a ghost plus a score — project it so the P7.2 replay
 * pipeline (ghostViewAt + ghost-render) plays the challenger's climb with
 * zero new render code.
 */
export function challengeToGhost(ch: DuelChallenge): GhostEntry {
  return {
    name: ch.name,
    charId: ch.charId,
    candlesPassed: ch.candlesPassed,
    symbol: ch.symbol,
    date: ch.date,
    interval: ch.interval,
    ts: ch.ts,
    samples: ch.samples,
  };
}

/** Shareable deep link for a challenge (origin injected for purity). */
export function duelUrl(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, "")}/?duel=${encodeURIComponent(code)}`;
}

/** True when `date` is not older than the duel TTL (store prunes the rest). */
export function duelExpired(ch: DuelChallenge, now: number = Date.now()): boolean {
  return now - ch.ts > DUEL_TTL_DAYS * 86_400_000;
}
