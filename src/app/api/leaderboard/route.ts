// /api/leaderboard — global daily board (in-memory slice; Supabase swap in P1)
import { NextResponse } from "next/server";

export interface BoardEntry {
  name: string;
  score: number;
  candlesPassed: number;
  symbol: string;
  date: string;
  ts: number;
}

const store: BoardEntry[] = [];
const MAX = 500;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const rows = (date ? store.filter((e) => e.date === date) : store)
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);
  return NextResponse.json({ entries: rows });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<BoardEntry>;
    const name = String(body.name ?? "").trim().slice(0, 14) || "ANON";
    const score = Math.floor(Number(body.score ?? 0));
    const candlesPassed = Math.floor(Number(body.candlesPassed ?? 0));
    const symbol = String(body.symbol ?? "").slice(0, 12) || "N/A";
    const date = String(body.date ?? "").slice(0, 10);
    if (!Number.isFinite(score) || score < 0 || score > 10_000_000) {
      return NextResponse.json({ error: "invalid score" }, { status: 400 });
    }
    const entry: BoardEntry = { name, score, candlesPassed, symbol, date, ts: Date.now() };
    store.push(entry);
    if (store.length > MAX) store.splice(0, store.length - MAX);
    const sorted = [...store].sort((a, b) => b.score - a.score);
    const rank = sorted.findIndex((e) => e.ts === entry.ts) + 1;
    return NextResponse.json({ ok: true, rank });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
