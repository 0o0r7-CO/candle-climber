/// <reference types="bun-types" />
// W5 pins for H4 DAILY REPORT (P2.4, bun test, zero deps). aggregateDay must
// be PURE and deterministic; the narrative may only contain numbers read off
// the report (GROWTH-AND-HOOKS §8 honesty red line — no invented counts).
import { describe, test, expect } from "bun:test";
import {
  aggregateDay,
  reportNarrative,
  emptyNarrative,
  type DayReport,
  type ReportContext,
} from "@/lib/report";
import type { BoardEntry } from "@/lib/leaderboard-store";

const e = (over: Partial<BoardEntry>): BoardEntry => ({
  name: "ANON",
  score: 100,
  candlesPassed: 10,
  bestStreak: 2,
  mutation: "clean",
  symbol: "BTCUSDT",
  date: "2026-09-29",
  ts: 1,
  ...over,
});

const ctx: ReportContext = { symbol: "BTCUSDT", tomorrowSymbol: "ETHUSDT" };

describe("W5 aggregateDay purity & determinism", () => {
  const entries = [
    e({ name: "A", score: 500, candlesPassed: 40, bestStreak: 9, mutation: "candle-rain" }),
    e({ name: "B", score: 120, candlesPassed: 11, bestStreak: 3 }),
    e({ name: "C", score: 300, candlesPassed: 25, bestStreak: 5, mutation: "candle-rain" }),
    e({ name: "D", score: 300, candlesPassed: 25, bestStreak: 4, mutation: "low-gravity" }),
  ];

  test("same input x2 -> byte-identical report", () => {
    const a = JSON.stringify(aggregateDay(entries));
    const b = JSON.stringify(aggregateDay(entries));
    expect(a).toBe(b);
  });

  test("NEVER mutates the input entries", () => {
    const before = JSON.stringify(entries);
    aggregateDay(entries);
    expect(JSON.stringify(entries)).toBe(before);
  });

  test("empty day -> null (the honest unclimbed episode)", () => {
    expect(aggregateDay([])).toBeNull();
  });
});

describe("W5 aggregateDay math", () => {
  const entries = [
    e({ name: "TOP", score: 500, candlesPassed: 40, bestStreak: 9, mutation: "candle-rain" }),
    e({ score: 120, candlesPassed: 11 }),
    e({ score: 300, candlesPassed: 25, mutation: "candle-rain" }),
    e({ score: 300, candlesPassed: 25, mutation: "low-gravity" }),
  ];
  const rep = aggregateDay(entries) as DayReport;

  test("top score/name, climbers, streak, total height", () => {
    expect(rep.climbers).toBe(4);
    expect(rep.topScore).toBe(500);
    expect(rep.topName).toBe("TOP");
    expect(rep.bestStreak).toBe(9);
    expect(rep.totalHeight).toBe(40 + 11 + 25 + 25);
  });

  test("median: even count averages the two middle scores", () => {
    // sorted [120,300,300,500] -> (300+300)/2 = 300
    expect(rep.medianScore).toBe(300);
  });

  test("median: odd count takes the middle", () => {
    const rep3 = aggregateDay([e({ score: 100 }), e({ score: 250 }), e({ score: 900 })]) as DayReport;
    expect(rep3.medianScore).toBe(250);
  });

  test("topMutation: mode over non-clean mutations, ties broken deterministically", () => {
    expect(rep.topMutation).toBe("candle-rain"); // 2 runs vs 1
    expect(rep.topMutationRuns).toBe(2);
    const tie = aggregateDay([
      e({ mutation: "aaa" }),
      e({ mutation: "zzz" }),
    ]) as DayReport;
    expect(tie.topMutation).toBe("aaa"); // lexicographic tiebreak
    const allClean = aggregateDay([e({}), e({})]) as DayReport;
    expect(allClean.topMutation).toBeNull();
    expect(allClean.topMutationRuns).toBe(0);
  });
});

describe("W5 narrative honesty (no invented figures)", () => {
  const rep = aggregateDay([
    e({ name: "WICK_42", score: 4311, candlesPassed: 88, bestStreak: 9, mutation: "candle-rain" }),
    e({ score: 210, candlesPassed: 21, mutation: "candle-rain" }),
  ]) as DayReport;

  test("every number in the narrative exists in the report/context", () => {
    const lines = reportNarrative(rep, ctx);
    const joined = lines.join(" ");
    expect(joined).toContain("2 recorded climbs");
    expect(joined).toContain("WICK_42");
    expect(joined).toContain("4,311");
    expect(joined).toContain("x9");
    expect(joined).toContain("109"); // total candles 88+21
    expect(joined).toContain("ETHUSDT"); // tomorrow cliffhanger
    expect(joined).toContain("CANDLE-RAIN"); // signature hazard (uppercased)
  });

  test("total height = sum of candlesPassed", () => {
    expect(rep.totalHeight).toBe(88 + 21);
  });

  test("single climb reads grammatically", () => {
    const one = aggregateDay([e({ name: "SOLO", score: 50 })]) as DayReport;
    expect(reportNarrative(one, ctx)[0]).toContain("1 recorded climb on BTCUSDT.");
  });

  test("empty-day episode is honest (no fabricated stats)", () => {
    const lines = emptyNarrative("2026-09-29", "BTCUSDT");
    const joined = lines.join(" ");
    expect(joined).toContain("No recorded climbs");
    expect(joined).toContain("unclimbed");
    expect(joined).not.toContain("0 recorded");
  });
});
