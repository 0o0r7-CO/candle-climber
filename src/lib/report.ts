// H4 DAILY REPORT — "every night, one episode" (P2.4 / GROWTH-AND-HOOKS §6).
// PURE aggregation core: real leaderboard entries in, an honest day-summary
// out. RED LINE (GROWTH-AND-HOOKS §8): every number in the narrative comes
// from the store — we never fabricate death counts or play counts we do not
// record; an empty day says "unclimbed", not a made-up story. The route
// (transport) wraps this; W5 pins the math.
import type { BoardEntry } from "@/lib/leaderboard-store";

export interface DayReport {
  date: string;
  climbers: number; // recorded submissions for the day (honest: submissions, not players)
  topScore: number;
  topName: string;
  bestStreak: number;
  medianScore: number;
  totalHeight: number; // sum of candlesPassed across entries
  topMutation: string | null; // most common non-clean mutation
  topMutationRuns: number;
}

export interface ReportContext {
  symbol: string; // the level symbol the narrative is framed on
  tomorrowSymbol: string; // the seeded rotation writes tomorrow's terrain
}

export function aggregateDay(entries: BoardEntry[]): DayReport | null {
  if (!entries || entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => a.score - b.score);
  const mid = Math.floor(sorted.length / 2);
  const medianScore =
    sorted.length % 2 === 1
      ? sorted[mid].score
      : Math.round((sorted[mid - 1].score + sorted[mid].score) / 2);

  const top = entries.reduce((a, b) => (b.score > a.score ? b : a), entries[0]);
  const bestStreak = entries.reduce((m, e) => Math.max(m, e.bestStreak ?? 0), 0);

  // most common non-clean mutation (ties -> first reached, deterministic by
  // lexicographic order for stability)
  const mutCount = new Map<string, number>();
  for (const e of entries) {
    if (!e.mutation || e.mutation === "clean") continue;
    mutCount.set(e.mutation, (mutCount.get(e.mutation) ?? 0) + 1);
  }
  let topMutation: string | null = null;
  let topMutationRuns = 0;
  for (const [m, n] of [...mutCount.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (n > topMutationRuns) {
      topMutation = m;
      topMutationRuns = n;
    }
  }

  return {
    date: entries[0].date,
    climbers: entries.length,
    topScore: top.score,
    topName: top.name,
    bestStreak,
    medianScore,
    totalHeight: entries.reduce((s, e) => s + Math.max(0, e.candlesPassed), 0),
    topMutation,
    topMutationRuns,
  };
}

/** Narrative lines — the serial cliffhanger. Every figure is read straight
 *  off the report; nothing is invented. Terrain-flavor lines (the day's real
 *  move/difficulty) are deliberately omitted until the report route can fetch
 *  live closed candles — a synthetic move would violate GROWTH-AND-HOOKS §8. */
export function reportNarrative(rep: DayReport, ctx: ReportContext): string[] {
  const lines: string[] = [];
  lines.push(
    `${rep.climbers} recorded climb${rep.climbers === 1 ? "" : "s"} on ${ctx.symbol}.`,
  );
  lines.push(`Top: ${rep.topName} — ${rep.topScore.toLocaleString()} pts. Best streak x${rep.bestStreak}. Median run: ${rep.medianScore.toLocaleString()}.`);
  if (rep.topMutation) {
    lines.push(`Signature hazard: ${rep.topMutation.toUpperCase()} (${rep.topMutationRuns} run${rep.topMutationRuns === 1 ? "" : "s"}).`);
  }
  lines.push(`Total height climbed: ${rep.totalHeight.toLocaleString()} candles. Tomorrow's terrain is written by ${ctx.tomorrowSymbol}.`);
  return lines;
}

/** The honest empty-day episode. */
export function emptyNarrative(date: string, symbol: string): string[] {
  return [
    `No recorded climbs on ${symbol} for ${date}.`,
    "The mountain stood unclimbed. It is still there.",
  ];
}
