/// <reference types="bun-types" />
// W5 feed-parser contract tests (bun test, zero deps, ZERO network — fixtures
// only; binance/stooq/vibe are never contacted).
//
//  - src/lib/stooq.ts parseStooqCsv: the W3 wire-format contract, now pure and
//    extracted from /api/candles (the fetch wrapper stayed in the route).
//  - src/lib/vibe-launch.ts vibeLaunchCandles + launchSymbol: the W3 derived-
//    terrain mapping (pure in (launch, date) by design).
import { describe, test, expect } from "bun:test";
import { parseStooqCsv, STOOQ_CSV_HEADER, MIN_CLOSED_ROWS } from "@/lib/stooq";
import { vibeLaunchCandles, launchSymbol, type VibeLaunch } from "@/lib/vibe-launch";

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const NOW = Date.parse("2026-09-30T00:00:00Z"); // the caller's injected clock

/* ----------------------------- stooq fixtures ----------------------------- */

function row(date: string, o: number, h: number, l: number, c: number): string {
  return `${date},${o},${h},${l},${c},1000000`;
}

function csv(rows: string[]): string {
  return [STOOQ_CSV_HEADER, ...rows].join("\n");
}

/** `count` weekly dates stepping back 7d from `endDate` (YYYY-MM-DD). */
function weeklyDates(count: number, endDate: string): string[] {
  const out: string[] = [];
  let t = Date.parse(`${endDate}T00:00:00Z`);
  for (let i = 0; i < count; i++) {
    out.push(new Date(t).toISOString().slice(0, 10));
    t -= WEEK_MS;
  }
  return out.reverse(); // CSV is chronological, oldest first
}

// 45 fully-closed weeks ending 2026-09-21 (closes 2026-09-28 <= NOW)
const CLOSED_ROWS = weeklyDates(45, "2026-09-21").map((d, i) => row(d, 10 + i, 11 + i, 9.5 + i, 10.5 + i));

describe("W5 stooq CSV parser (pure)", () => {
  test("valid CSV -> candles with correct t/o/h/l/c", () => {
    const candles = parseStooqCsv(csv(CLOSED_ROWS), NOW);
    expect(candles).not.toBeNull();
    expect(candles!.length).toBe(45);
    expect(candles![0]).toEqual({
      t: Date.parse("2025-11-17T00:00:00Z"),
      o: 10,
      h: 11,
      l: 9.5,
      c: 10.5,
      v: 1000000, // P2.3: volume rides along for the H2 weather fog
    });
    expect(candles![1].t).toBe(candles![0].t + WEEK_MS);
    expect(candles![44].t).toBe(Date.parse("2026-09-21T00:00:00Z"));
    expect(candles![44].c).toBe(54.5);
  });

  test("in-progress week (row date + 7d > now) dropped; boundary (== now) kept", () => {
    const withLiveWeek = csv([...CLOSED_ROWS, row("2026-09-28", 55, 56, 54, 55.5)]); // closes 2026-10-05 > NOW
    const candles = parseStooqCsv(withLiveWeek, NOW);
    expect(candles!.length).toBe(45); // live row dropped
    expect(candles![44].t).toBe(Date.parse("2026-09-21T00:00:00Z"));
    // exact boundary: a row dated 2026-09-23 closes exactly at NOW -> CLOSED
    const boundary = csv([...CLOSED_ROWS.slice(1), row("2026-09-23", 55, 56, 54, 55.5)]);
    const kept = parseStooqCsv(boundary, NOW);
    expect(kept!.length).toBe(45);
    expect(kept![44].t).toBe(Date.parse("2026-09-23T00:00:00Z"));
  });

  test(`<${MIN_CLOSED_ROWS} closed rows -> null; exactly ${MIN_CLOSED_ROWS} -> candles`, () => {
    expect(parseStooqCsv(csv(CLOSED_ROWS.slice(0, 39)), NOW)).toBeNull();
    expect(parseStooqCsv(csv(CLOSED_ROWS.slice(0, 40)), NOW)).not.toBeNull();
    // even a huge payload is null if fewer than MIN_CLOSED_ROWS survive the
    // closed-week filter: 200 rows dated FORWARD from 2026-09-24 (every one
    // still in-progress at NOW: date + 7d > 2026-09-30) -> only the 10 closed
    // rows survive -> 10 < 40 -> null
    const liveRows = Array.from({ length: 200 }, (_, i) => {
      const t = Date.parse("2026-09-24T00:00:00Z") + i * WEEK_MS;
      return row(new Date(t).toISOString().slice(0, 10), 1 + i, 2 + i, 0.5 + i, 1.5 + i);
    });
    const mostlyLive = csv([...CLOSED_ROWS.slice(0, 10), ...liveRows]);
    expect(parseStooqCsv(mostlyLive, NOW)).toBeNull();
  });

  test("challenge-page HTML payload (starts with <!DOCTYPE) -> null", () => {
    expect(parseStooqCsv("<!DOCTYPE html><html><body>Checking your browser</body></html>", NOW)).toBeNull();
    // other non-CSV junk too
    expect(parseStooqCsv("", NOW)).toBeNull();
    expect(parseStooqCsv('{"error":"Access denied"}', NOW)).toBeNull();
    expect(parseStooqCsv("Date,Open,High,Low,Close", NOW)).toBeNull(); // wrong header
  });

  test("malformed rows skipped, good rows kept", () => {
    const mixed = csv([
      row("2025-11-17", 10, 11, 9.5, 10.5),
      "garbage", // 1 field
      "2025-11-24,10,11,9.5", // 4 fields
      "2025-12-01,abc,def,ghi,jkl", // NaN prices
      "not-a-date,10,11,9.5,10.5", // invalid date
      row("2025-12-08", 10.5, 11.5, 10, 11),
      "", // empty line
      ...weeklyDates(43, "2026-09-14").map((d, i) => row(d, 20 + i, 21 + i, 19.5 + i, 20.5 + i)),
    ]);
    const candles = parseStooqCsv(mixed, NOW);
    expect(candles).not.toBeNull();
    expect(candles!.length).toBe(45); // 2 good + 43 good; 5 malformed skipped
    expect(candles![1].t).toBe(Date.parse("2025-12-08T00:00:00Z"));
  });
});

/* ---------------------------- yahoo v8 fixtures ---------------------------- */

import { parseYahooChart, yahooChartUrl, MIN_CLOSED_ROWS_YAHOO } from "@/lib/yahoo";

// Yahoo v8 chart fixture builder — mirrors the real wire shape:
// { chart: { result: [ { timestamp: sec[], indicators: { quote: [ {...} ] } } ], error: null } }
function yahooWeeks(n: number, startSec: number): { ts: number[]; q: Record<string, (number | null)[]> } {
  const ts: number[] = [];
  const open: number[] = [], high: number[] = [], low: number[] = [], close: number[] = [], volume: number[] = [];
  for (let i = 0; i < n; i++) {
    ts.push(startSec + i * 7 * 86400);
    open.push(10 + i); high.push(11 + i); low.push(9.5 + i); close.push(10.5 + i); volume.push(1000 + i);
  }
  return { ts, q: { open, high, low, close, volume } };
}

function yahooBody(weeks: { ts: number[]; q: Record<string, (number | null)[]> } | null, withError = false): unknown {
  if (withError) return { chart: { result: null, error: { code: "Bad Request", description: "Invalid input" } } };
  if (!weeks) return { chart: { result: [], error: null } };
  return {
    chart: {
      result: [{
        meta: { currency: "USD", symbol: "TSLA", exchangeName: "NMS" },
        timestamp: weeks.ts,
        indicators: { quote: [weeks.q] },
      }],
      error: null,
    },
  };
}

const YAHOO_NOW = Date.parse("2026-09-30T12:00:00Z"); // a Wednesday
// 52 weekly rows anchored RELATIVE to NOW (+1h offset): every row except the
// last closes strictly before NOW (51 closed, last row = in-progress week).
const YAHOO_START_SEC = Math.floor(YAHOO_NOW / 1000) - 52 * 7 * 86_400 + 3_600;

describe("W5 yahoo v8 chart parser (pure) — W3.1 primary stock feed", () => {
  test("valid chart JSON -> candles with t in ms and correct o/h/l/c", () => {
    const weeks = yahooWeeks(52, YAHOO_START_SEC);
    const candles = parseYahooChart(yahooBody(weeks), YAHOO_NOW);
    expect(candles).not.toBeNull();
    expect(candles!.length).toBe(51); // 52 rows - 1 in-progress
    expect(candles![0]).toEqual({
      t: YAHOO_START_SEC * 1000, o: 10, h: 11, l: 9.5, c: 10.5, v: 1000,
    });
    // weekly cadence preserved
    expect(candles![1].t - candles![0].t).toBe(7 * 86_400_000);
  });

  test("in-progress week (week-start + 7d > now) dropped; boundary (== now) kept", () => {
    // 45-row fixtures (>= MIN_CLOSED_ROWS) straddling the boundary by 1s:
    // startA's last row closes exactly AT now (kept); startA+1s closes 1s
    // after now (dropped as the in-progress week).
    const startA = Math.floor(YAHOO_NOW / 1000) - 45 * 7 * 86_400;
    const boundaryKept = parseYahooChart(yahooBody(yahooWeeks(45, startA)), YAHOO_NOW)!;
    expect(boundaryKept.length).toBe(45);
    const boundaryDropped = parseYahooChart(yahooBody(yahooWeeks(45, startA + 1)), YAHOO_NOW)!;
    expect(boundaryDropped.length).toBe(44);
  });

  test(`volume field optional; malformed/zero volume omitted`, () => {
    const weeks = yahooWeeks(45, YAHOO_START_SEC);
    weeks.q.volume[0] = null;
    weeks.q.volume[1] = 0;
    const candles = parseYahooChart(yahooBody(weeks), YAHOO_NOW)!;
    expect(candles).not.toBeNull();
    expect(candles[0].v).toBeUndefined();
    expect(candles[1].v).toBeUndefined();
    expect(candles[2].v).toBe(1002);
  });

  test(`rows with null/non-finite OHLC skipped; <${MIN_CLOSED_ROWS_YAHOO} closed -> null`, () => {
    const weeks = yahooWeeks(45, YAHOO_START_SEC);
    weeks.q.open[0] = null;
    weeks.q.close[1] = null;
    const candles = parseYahooChart(yahooBody(weeks), YAHOO_NOW)!;
    expect(candles.length).toBe(43); // 45 rows - 2 null-OHLC (fixture starts 52w back -> no in-progress row)
    expect(parseYahooChart(yahooBody(yahooWeeks(40, YAHOO_START_SEC)), YAHOO_NOW)).not.toBeNull(); // 40 closed == MIN -> candles
    expect(parseYahooChart(yahooBody(yahooWeeks(39, YAHOO_START_SEC)), YAHOO_NOW)).toBeNull(); // 39 closed < 40 -> null
  });

  test("error/empty/HTML-ish payloads -> null (never throws)", () => {
    expect(parseYahooChart(yahooBody(null, true), YAHOO_NOW)).toBeNull(); // chart.error set
    expect(parseYahooChart(yahooBody(null), YAHOO_NOW)).toBeNull(); // empty result[]
    expect(parseYahooChart({ chart: { result: [{}] } }, YAHOO_NOW)).toBeNull(); // no timestamps
    expect(parseYahooChart({ chart: { result: [{ timestamp: [] }] } }, YAHOO_NOW)).toBeNull();
    expect(parseYahooChart({}, YAHOO_NOW)).toBeNull();
    expect(parseYahooChart(null, YAHOO_NOW)).toBeNull();
    expect(parseYahooChart("<!DOCTYPE html><body>Rate limited</body>", YAHOO_NOW)).toBeNull();
    expect(parseYahooChart(undefined, YAHOO_NOW)).toBeNull();
  });

  test("yahooChartUrl — symbol interpolated, 1wk/10y params pinned", () => {
    expect(yahooChartUrl("TSLA", "https://query1.finance.yahoo.com")).toBe(
      "https://query1.finance.yahoo.com/v8/finance/chart/TSLA?interval=1wk&range=10y"
    );
  });
});

/* --------------------------- vibe-launch fixtures -------------------------- */

const LAUNCH: VibeLaunch = {
  launchId: "cc-test-launch-002",
  symbol: "MONKY",
  createdAt: "2026-07-01T10:00:00.000Z",
  graduated: false,
  holderCount: 128,
  volume24hPairUnits: "920000000000000000000",
  buyCount24h: 640,
  sellCount24h: 590,
};

function launchAged(days: number): VibeLaunch {
  return { ...LAUNCH, createdAt: new Date(NOW - days * DAY_MS).toISOString() };
}

describe("W5 vibe-launch derivation (pure)", () => {
  test("same launch fixture + same date x2 -> byte-identical arrays", () => {
    const a = vibeLaunchCandles(LAUNCH, "2026-09-30");
    const b = vibeLaunchCandles(LAUNCH, "2026-09-30");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b)); // byte-identical
    expect(a).toEqual(b);
    // different date -> different terrain (age + seed both shift)
    expect(JSON.stringify(vibeLaunchCandles(LAUNCH, "2026-09-29"))).not.toBe(JSON.stringify(a));
  });

  test("count clamped to [60, 219]: age 0 -> 60, age 9999 -> 219, age 100 -> 160", () => {
    expect(vibeLaunchCandles(launchAged(0), "2026-09-30").length).toBe(60);
    expect(vibeLaunchCandles(launchAged(9999), "2026-09-30").length).toBe(219);
    expect(vibeLaunchCandles(launchAged(100), "2026-09-30").length).toBe(160);
    // future createdAt (launch "tomorrow") clamps to age 0 -> 60
    const future = { ...LAUNCH, createdAt: "2026-10-05T00:00:00.000Z" };
    expect(vibeLaunchCandles(future, "2026-09-30").length).toBe(60);
    // weekly spacing: t0 = date - count*7d, one candle per week
    const c = vibeLaunchCandles(launchAged(0), "2026-09-30");
    expect(c[0].t).toBe(NOW - 60 * WEEK_MS);
    expect(c[1].t - c[0].t).toBe(WEEK_MS);
  });

  test("launchSymbol sanitization", () => {
    expect(launchSymbol("to the moon!!!")).toBe("TOTHEMOON");
    expect(launchSymbol("")).toBe("VIBELAUNCH");
    expect(launchSymbol("!!!@@")).toBe("VIBELAUNCH"); // nothing survives -> fallback
    expect(launchSymbol("a very long ticker")).toBe("AVERYLONGT"); // sliced to 10
    expect(launchSymbol("off!")).toBe("OFF");
    expect(launchSymbol("monky-69")).toBe("MONKY69");
  });
});
