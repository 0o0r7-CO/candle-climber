// /api/report — H4 DAILY REPORT (P2.4): pure aggregation over the day's real
// leaderboard entries. Default report = YESTERDAY (a completed day); any past
// UTC date is allowed via ?date= (archive-friendly), future/malformed dates
// fall back to yesterday. Honesty rule (GROWTH-AND-HOOKS §8): every number is
// read off the store — an empty day reports "unclimbed", never invented data.
// Cross-day history/durability lands with O1 (DATABASE_URL); the memory store
// serves same-instance aggregates until then.
import { NextResponse } from "next/server";
import { getBoard } from "@/lib/leaderboard-store";
import { aggregateDay, reportNarrative, emptyNarrative, type ReportContext } from "@/lib/report";
import { pickSeed } from "@/game/cc/level-source";
import { isArchiveDate } from "@/game/cc/archive";
import { utcDateStr } from "@/game/cc/rng";

function yesterdayStr(today: string): string {
  return new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const today = utcDateStr();
  const requested = searchParams.get("date");
  // A report describes a COMPLETED day: strictly past dates only, same rule
  // as the archive (future terrain/dates are never acknowledged).
  const date = isArchiveDate(requested, today) ? (requested as string) : yesterdayStr(today);
  const symbol = pickSeed(date).symbol;

  const store = getBoard();
  // 2000 = memory store's hard cap; for Mongo it is a sane M0-sized window.
  const entries = await store.top(date, 2000);

  const rep = aggregateDay(entries);
  const tomorrowSymbol = pickSeed(
    new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10),
  ).symbol;
  const ctx: ReportContext = { symbol, tomorrowSymbol };

  return NextResponse.json(
    {
      date,
      symbol,
      report: rep, // null = honest empty day
      narrative: rep ? reportNarrative(rep, ctx) : emptyNarrative(date, symbol),
      tomorrowSymbol,
      store: store.kind,
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
