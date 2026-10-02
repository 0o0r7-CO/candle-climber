// /api/ghosts — per-terrain position-stream ghosts (P7.2).
// GET  ?symbol=&date=&interval= → best ghosts for that terrain (champion first)
// POST → record a run's ghost; HMAC run-token MANDATORY (issued by
//        /api/candles, same as the leaderboard); symbol/date/interval are
//        pinned EXCLUSIVELY from the verified token payload.
// COSMETIC CONTRACT: ghosts never affect scores/ranks (W5 untouched) — the
// integrity posture here protects the STORE (shape/bounds/doc size), not
// competitive truth.
import { NextResponse } from "next/server";
import { getGhostStore } from "@/lib/ghost-store";
import { verifyRunToken, isTokenStale } from "@/lib/run-token";
import { validateGhost } from "@/game/cc/ghost";
import { isInterval } from "@/game/cc/level-source";
import { MAX_CANDLES } from "@/lib/board-validation";

/* per-IP rate limit: 20 submissions / minute / instance (same as leaderboard) */
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

function cleanParam(v: string | null, max = 12): string {
  return (v ?? "").replace(/[^A-Za-z0-9._-]/g, "").slice(0, max);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = cleanParam(searchParams.get("symbol"));
  const date = cleanParam(searchParams.get("date"), 10);
  const interval = isInterval(searchParams.get("interval")) ? searchParams.get("interval")! : "1w";
  if (!symbol || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ghosts: [] });
  }
  const store = getGhostStore();
  const ghosts = await store.top(symbol, date, interval);
  return NextResponse.json({
    ghosts,
    store: store.kind,
    ...(store.lastError ? { dbError: store.lastError } : {}),
  });
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
    // identical posture to /api/leaderboard (W1)
    const tok = verifyRunToken(body.runToken);
    if (!tok) {
      return NextResponse.json({ error: "invalid run token" }, { status: 403 });
    }
    if (isTokenStale(tok.date)) {
      return NextResponse.json({ error: "run token expired" }, { status: 403 });
    }

    // pure validation core: shape + bounds + physical sanity; symbol/date/
    // interval pinned from the token — client claims are ignored
    const verdict = validateGhost(body, tok, MAX_CANDLES);
    if (!verdict.ok) {
      return NextResponse.json({ error: verdict.error }, { status: verdict.status });
    }

    const store = getGhostStore();
    await store.add(verdict.entry);
    return NextResponse.json({ ok: true, store: store.kind });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
