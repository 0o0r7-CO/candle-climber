/// <reference types="bun-types" />
// W5 pins for H1 ARCHIVE (P2.2, bun test, zero deps). The archive module is
// the mechanics spine of "levels are documentary": every function must be a
// PURE function of its arguments (clock injected — no Date.now()), the same
// terrain must always tag identically, no-future-dates is absolute, and the
// curated era config must stay deep-linkable (whitelisted symbols, unique
// ids). Archive runs are PRACTICE — nothing here touches the W1 leaderboard.
import { describe, test, expect } from "bun:test";
import {
  WEEK_MS,
  ARCHIVE_MIN_DATE,
  ERAS,
  isArchiveDate,
  endOfDayMs,
  clampCandlesTo,
  archiveTag,
  recentDailies,
  archiveHref,
  binanceKlinesUrl,
} from "@/game/cc/archive";
import { WATCHLIST, pickSeed, syntheticCandles, LIMIT } from "@/game/cc/level-source";
import type { Candle } from "@/game/cc/types";

const TODAY = "2026-09-30";
const c = (t: number, o: number, h: number, l: number, cl: number): Candle => ({ t, o, h, l, c: cl });

describe("W5 archive date validation (no future terrain, ever)", () => {
  test("accepts strictly-past well-formed dates >= ARCHIVE_MIN_DATE", () => {
    expect(isArchiveDate("2020-03-12", TODAY)).toBe(true);
    expect(isArchiveDate("2017-01-01", TODAY)).toBe(true);
    expect(isArchiveDate("2026-09-29", TODAY)).toBe(true); // yesterday
  });

  test("rejects today, future, malformed, non-string, pre-floor dates", () => {
    expect(isArchiveDate(TODAY, TODAY)).toBe(false); // today is the daily level
    expect(isArchiveDate("2026-10-01", TODAY)).toBe(false); // tomorrow
    expect(isArchiveDate("2099-01-01", TODAY)).toBe(false);
    expect(isArchiveDate("2026-9-12", TODAY)).toBe(false); // malformed
    expect(isArchiveDate("2020-03-12T00:00:00Z", TODAY)).toBe(false);
    expect(isArchiveDate("", TODAY)).toBe(false);
    expect(isArchiveDate(null, TODAY)).toBe(false);
    expect(isArchiveDate(42, TODAY)).toBe(false);
    expect(isArchiveDate("2016-12-31", TODAY)).toBe(false); // below floor
    expect(isArchiveDate("2020-13-12", TODAY)).toBe(false); // invalid month
  });
});

describe("W5 archive clamping (closed candles only shape archive terrain)", () => {
  // weekly candles: open Mondays, close 7d later.
  const candles = [
    c(Date.parse("2020-03-02T00:00:00Z"), 100, 120, 90, 110), // closes 03-09 (<= end of 03-12) -> kept
    c(Date.parse("2020-03-09T00:00:00Z"), 110, 150, 80, 90),  // closes 03-16 (after 03-12) -> DROPPED
    c(Date.parse("2020-02-24T00:00:00Z"), 105, 112, 95, 100), // closes 03-02 -> kept
  ];

  test("drops the in-progress candle; keeps only candles closed by end-of-day", () => {
    const out = clampCandlesTo(candles, "2020-03-12");
    expect(out).toHaveLength(2);
    expect(out.some((x) => x.t === Date.parse("2020-03-09T00:00:00Z"))).toBe(false);
  });

  test("NEVER mutates the input (server owns the fetched series)", () => {
    const before = JSON.stringify(candles);
    clampCandlesTo(candles, "2020-03-12");
    expect(JSON.stringify(candles)).toBe(before);
  });

  test("deterministic: same input x2 -> byte-identical output", () => {
    const a = JSON.stringify(clampCandlesTo(candles, "2020-03-12"));
    const b = JSON.stringify(clampCandlesTo(candles, "2020-03-12"));
    expect(a).toBe(b);
  });

  test("endOfDayMs is the last ms of the UTC day", () => {
    expect(endOfDayMs("2020-03-12")).toBe(Date.parse("2020-03-13T00:00:00Z") - 1);
  });

  test("WEEK_MS is exactly 7 days", () => {
    expect(WEEK_MS).toBe(604_800_000);
  });
});

describe("W5 archive difficulty auto-tag (honest, deterministic)", () => {
  test("byte-deterministic for the same terrain", () => {
    const candles = syntheticCandles("2020-03-12", LIMIT);
    expect(archiveTag(candles)).toBe(archiveTag(candles));
  });

  test("COVID-style crash week tags LEGENDARY (range >= 45% of open)", () => {
    // one monster candle in the tail: open 100, high 120, low 55, close 75
    const tail = Array.from({ length: 10 }, (_, i) =>
      c(i * WEEK_MS, 100, 104, 96, 101),
    );
    tail[tail.length - 1] = c(10 * WEEK_MS, 100, 120, 55, 75);
    expect(archiveTag(tail)).toBe("LEGENDARY");
  });

  test("LUNA-style -20% body week tags LEGENDARY", () => {
    const tail = Array.from({ length: 10 }, (_, i) =>
      c(i * WEEK_MS, 100, 104, 96, 101),
    );
    tail[tail.length - 1] = c(10 * WEEK_MS, 100, 102, 78, 80); // (c-o)/o = -20%
    expect(archiveTag(tail)).toBe("LEGENDARY");
  });

  test("moderate dump tags BRUTAL, quiet drift tags CALM, rest ROCKY", () => {
    const rocky = Array.from({ length: 12 }, (_, i) =>
      c(i * WEEK_MS, 100, 110, 92, i % 2 ? 105 : 96),
    );
    expect(archiveTag(rocky)).toBe("ROCKY");

    const brutal = rocky.slice();
    brutal[brutal.length - 1] = c(11 * WEEK_MS, 100, 116, 82, 88); // -12% body, 34% range
    expect(archiveTag(brutal)).toBe("BRUTAL");

    const calm = Array.from({ length: 12 }, (_, i) =>
      c(i * WEEK_MS, 100, 100.6, 99.4, 100.2),
    );
    expect(archiveTag(calm)).toBe("CALM");
  });

  test("only the TAIL counts: a crash far in the past does not tag the era", () => {
    const candles = Array.from({ length: 60 }, (_, i) =>
      c(i * WEEK_MS, 100, 110, 92, i % 2 ? 105 : 96),
    );
    candles[0] = c(0, 100, 180, 40, 60); // prehistoric monster — outside the tail
    expect(archiveTag(candles)).toBe("ROCKY");
  });

  test("empty series -> ROCKY (never throws)", () => {
    expect(archiveTag([])).toBe("ROCKY");
  });
});

describe("W5 archive recent dailies (pure rotation replay)", () => {
  test("n rows, strictly descending dates, symbols match the seeded rotation", () => {
    const rows = recentDailies(TODAY, 10);
    expect(rows).toHaveLength(10);
    for (let i = 0; i < rows.length; i++) {
      expect(rows[i].symbol).toBe(pickSeed(rows[i].date).symbol);
      expect(WATCHLIST).toContain(rows[i].symbol);
      if (i > 0) expect(rows[i - 1].date > rows[i].date).toBe(true);
    }
    expect(rows[0].date).toBe("2026-09-29"); // yesterday
    expect(rows[9].date).toBe("2026-09-20");
  });
});

describe("W5 archive deep links (whitelist-checked)", () => {
  test("builds /?symbol=&date= and carries renderer=v2", () => {
    expect(archiveHref({ symbol: "BTCUSDT", date: "2020-03-12" }, TODAY)).toBe("/?symbol=BTCUSDT&date=2020-03-12");
    expect(archiveHref({ symbol: "BTCUSDT", date: "2020-03-12", renderer: "v2" }, TODAY)).toBe(
      "/?symbol=BTCUSDT&date=2020-03-12&renderer=v2",
    );
  });

  test("unknown symbol or non-archive date degrades to / (no tampered URLs)", () => {
    expect(archiveHref({ symbol: "PEPEUSDT", date: "2020-03-12" }, TODAY)).toBe("/");
    expect(archiveHref({ symbol: "BTCUSDT", date: "2099-01-01" }, TODAY)).toBe("/");
    expect(archiveHref({ symbol: "BTCUSDT", date: "garbage" }, TODAY)).toBe("/");
  });
});

describe("W5 archive era config (curated, deep-linkable, honest)", () => {
  test("unique ids and unique (date, symbol) level pairs", () => {
    const ids = ERAS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const levels = ERAS.map((e) => `${e.symbol}|${e.date}`);
    expect(new Set(levels).size).toBe(levels.length);
  });

  test("every era is a valid archive level with whitelisted symbol + real content", () => {
    for (const e of ERAS) {
      expect(isArchiveDate(e.date, TODAY)).toBe(true);
      expect(WATCHLIST).toContain(e.symbol);
      expect(e.name.length).toBeGreaterThan(0);
      expect(e.blurb.length).toBeGreaterThan(0);
    }
  });

  test("eras predate the synthetic floor and terrain exists (>= 40 closed weeks)", () => {
    for (const e of ERAS) {
      const clamped = clampCandlesTo(syntheticCandles(e.date, LIMIT), e.date);
      // synthetic series always spans `count` weeks back from the date, so the
      // clamped window must retain the bulk of it — this pins clampCandlesTo
      // against accidental off-by-one regressions on real era dates.
      expect(clamped.length).toBeGreaterThanOrEqual(LIMIT - 2);
    }
  });
});

describe("W5 archive wire helper (binance URL builder)", () => {
  test("today path is byte-identical to the pre-archive URL", () => {
    expect(binanceKlinesUrl("https://api.binance.com", "BTCUSDT", "1w", 220)).toBe(
      "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1w&limit=220",
    );
  });

  test("archive path pins endTime to the archive day's end", () => {
    const url = binanceKlinesUrl("https://api.binance.com", "BTCUSDT", "1w", 220, endOfDayMs("2020-03-12"));
    expect(url).toBe(
      `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1w&limit=220&endTime=${endOfDayMs("2020-03-12")}`,
    );
  });

  test("ARCHIVE_MIN_DATE sanity (binance spot history context)", () => {
    expect(ARCHIVE_MIN_DATE).toBe("2017-01-01");
    expect(isArchiveDate(ARCHIVE_MIN_DATE, TODAY)).toBe(true);
  });
});
