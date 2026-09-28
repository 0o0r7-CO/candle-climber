// /api/leaderboard — global daily board.
// Storage: MongoStore when DATABASE_URL is set (Atlas M0, phase p1), else in-memory.
// Includes basic anti-cheat: score/candles consistency cap, name + date sanitizing,
// and a lightweight per-IP rate limit (in-memory, per instance).
import { NextResponse } from "next/server";
import { getBoard, type BoardEntry } from "@/lib/leaderboard-store";

const MAX_SCORE_PER_CANDLE = 70; // engine max gain: 10 * (1 + 12 * 0.5) = 70
const MAX_CANDLES = 1000;

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

function sanitizeName(raw: unknown): string {
  const s = String(raw ?? "")
    // strip control chars + angle brackets, keep it plain-text
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .trim()
    .slice(0, 14);
  return s || "ANON";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const store = getBoard();
  const entries = await store.top(date, 50);
  return NextResponse.json({ entries, store: store.kind });
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
    const body = (await req.json()) as Partial<BoardEntry>;
    const entry: BoardEntry = {
      name: sanitizeName(body.name),
      score: Math.floor(Number(body.score ?? 0)),
      candlesPassed: Math.floor(Number(body.candlesPassed ?? 0)),
      bestStreak: Math.max(0, Math.min(999, Math.floor(Number(body.bestStreak ?? 0)))),
      mutation: String(body.mutation ?? "").slice(0, 24) || undefined,
      symbol: String(body.symbol ?? "").slice(0, 12) || "N/A",
      date: String(body.date ?? "").slice(0, 10),
      ts: Date.now(),
    };

    // shape validation
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
      return NextResponse.json({ error: "invalid date" }, { status: 400 });
    }
    if (!Number.isFinite(entry.score) || entry.score < 0 || entry.score > 10_000_000) {
      return NextResponse.json({ error: "invalid score" }, { status: 400 });
    }
    if (!Number.isFinite(entry.candlesPassed) || entry.candlesPassed < 0 || entry.candlesPassed > MAX_CANDLES) {
      return NextResponse.json({ error: "invalid candles" }, { status: 400 });
    }
    // anti-cheat: score must be physically reachable from candles passed
    if (entry.score > entry.candlesPassed * MAX_SCORE_PER_CANDLE + 20) {
      return NextResponse.json({ error: "score inconsistent with run" }, { status: 400 });
    }

    const store = getBoard();
    const rank = await store.add(entry);
    return NextResponse.json({ ok: true, rank, store: store.kind });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
