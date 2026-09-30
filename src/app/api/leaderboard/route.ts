// /api/leaderboard — global daily board.
// Storage: MongoStore when DATABASE_URL is set (Atlas M0, phase p1), else in-memory.
// Includes basic anti-cheat: score/candles consistency cap, name + date sanitizing,
// and a lightweight per-IP rate limit (in-memory, per instance).
// W1 integrity: every submission MUST carry the HMAC runToken issued by
// GET /api/candles; symbol + date are pinned from the verified token payload
// (client-claimed symbol/date are ignored), and terrain-imposed physical caps
// reject impossible candle counts/scores.
import { NextResponse } from "next/server";
import { getBoard, type BoardEntry } from "@/lib/leaderboard-store";
import { verifyRunToken, isTokenStale } from "@/lib/run-token";
import { isInterval } from "@/game/cc/level-source";
// W5: pure validation core (shape + anti-cheat caps) extracted to
// src/lib/board-validation.ts — contract pinned by test/leaderboard-contract.test.ts.
import { validateSubmission } from "@/lib/board-validation";

/* per-IP rate limit: 20 submissions / minute / instance */
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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  // P3.5: boards are per-timeframe ("1w" classic default) — never mixed
  const interval = isInterval(searchParams.get("interval")) ? searchParams.get("interval")! : "1w";
  const store = getBoard();
  const entries = await store.top(date, 50, interval);
  return NextResponse.json({
    entries,
    interval,
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
    const body = (await req.json()) as Partial<BoardEntry> & { runToken?: unknown };

    // run token: mandatory, signature-verified (timingSafeEqual), shape-checked
    const tok = verifyRunToken(body.runToken);
    if (!tok) {
      return NextResponse.json({ error: "invalid run token" }, { status: 403 });
    }
    if (isTokenStale(tok.date)) {
      return NextResponse.json({ error: "run token expired" }, { status: 403 });
    }

    // pure validation core (W5): shape checks + terrain-physical anti-cheat caps
    const verdict = validateSubmission(body, tok);
    if (!verdict.ok) {
      return NextResponse.json({ error: verdict.error }, { status: verdict.status });
    }

    const store = getBoard();
    const rank = await store.add(verdict.entry);
    return NextResponse.json({ ok: true, rank, store: store.kind });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
