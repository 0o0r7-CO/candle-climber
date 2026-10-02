// /api/duels — async duel challenges (P7.3).
// POST → create a challenge from a COMPLETED run; HMAC run-token MANDATORY
//        (issued by /api/candles, same as the leaderboard + ghosts);
//        symbol/date/interval are pinned EXCLUSIVELY from the verified token
//        payload. Returns the short shareable code (the invitation).
// GET  ?code=XXXXXX → the challenge (incl. the challenger's position stream
//        so the accept side replays the climb it must beat).
// INTEGRITY POSTURE: identical to /api/ghosts — the route protects the STORE
// (shape/bounds/physical caps); duel verdicts are social truth and never
// touch leaderboard ranks/scores (W5 untouched).
import { NextResponse } from "next/server";
import { getDuelStore } from "@/lib/duel-store";
import { verifyRunToken, isTokenStale } from "@/lib/run-token";
import { validateDuelChallenge, DUEL_CODE_RE } from "@/game/cc/duel";
import { MAX_CANDLES } from "@/lib/board-validation";

/* per-IP rate limit: 20 requests / minute / instance (same as leaderboard) */
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (arr.length >= 20) return true;
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear(); // crude memory guard
  return false;
}

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "slow down" }, { status: 429 });
  }
  try {
    const body = (await req.json()) as Record<string, unknown>;

    // run token: mandatory, signature-verified (timingSafeEqual), shape-checked —
    // identical posture to /api/leaderboard (W1) and /api/ghosts (P7.2)
    const tok = verifyRunToken(body.runToken);
    if (!tok) {
      return NextResponse.json({ error: "invalid run token" }, { status: 403 });
    }
    if (isTokenStale(tok.date)) {
      return NextResponse.json({ error: "run token expired" }, { status: 403 });
    }

    // pure validation core: shape + bounds + physical sanity; symbol/date/
    // interval pinned from the token — client claims are ignored
    const verdict = validateDuelChallenge(body, tok, MAX_CANDLES);
    if (!verdict.ok) {
      return NextResponse.json({ error: verdict.error }, { status: verdict.status });
    }

    const store = getDuelStore();
    const code = await store.create(verdict.challenge);
    return NextResponse.json({ ok: true, code, store: store.kind });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = (searchParams.get("code") ?? "").toUpperCase();
  const code = raw.replace(/[^A-Z0-9]/g, "").slice(0, 8);
  if (!DUEL_CODE_RE.test(code)) {
    return NextResponse.json({ duel: null });
  }
  const store = getDuelStore();
  const duel = await store.get(code);
  return NextResponse.json({
    duel,
    store: store.kind,
    ...(store.lastError ? { dbError: store.lastError } : {}),
  });
}
