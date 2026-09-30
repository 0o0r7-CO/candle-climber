/// <reference types="bun-types" />
// P3.5 timeframe selector — contract tests (bun test, zero deps).
// Pins the three promises the owner proposal was ACCEPTED on:
//  1. NO BOARD MIXING — per-tf boards are isolated (memory store + submission
//     stamping: interval comes from the VERIFIED token, never the client body).
//  2. LEGACY COMPATIBILITY — legacy tokens (no interval field) verify as "1w",
//     legacy entries (no interval field) read as the "1w" board, and the
//     legacy weekly synthetic terrain stays byte-identical.
//  3. DETERMINISM — every timeframe is its own pure terrain (seed keys carry
//     the interval); same date+interval ⇒ same candles, different interval ⇒
//     different terrain.
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { createHash, createHmac } from "node:crypto";
import { syntheticCandles, isInterval, INTERVALS, INTERVAL_MS, LIMIT } from "@/game/cc/level-source";
import { signRunToken, verifyRunToken, type RunTokenPayload } from "@/lib/run-token";
import { validateSubmission } from "@/lib/board-validation";
import { MemoryStore } from "@/lib/leaderboard-store";

const DATE = "2026-10-01";
const SYMBOL = "ETHUSDT";
const CANDLE_JSON = JSON.stringify([{ t: 1, o: 2, h: 3, l: 1, c: 2 }]);

function craftToken(payload: Record<string, unknown>, secret = "tf-test-secret"): string {
  const p = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(p).digest("base64url");
  return `${p}.${sig}`;
}

beforeAll(() => {
  process.env.RUN_TOKEN_SECRET = "tf-test-secret";
});
afterAll(() => {
  delete process.env.RUN_TOKEN_SECRET;
});

describe("P3.5 interval whitelist + synthetic terrains", () => {
  test("isInterval: whitelist accepts 1w/1d/4h/1h, rejects everything else", () => {
    for (const iv of INTERVALS) expect(isInterval(iv)).toBe(true);
    expect(isInterval("2h")).toBe(false);
    expect(isInterval("1W")).toBe(false); // case-sensitive, server-strict
    expect(isInterval("")).toBe(false);
    expect(isInterval(null)).toBe(false);
    expect(isInterval(undefined)).toBe(false);
  });

  test("legacy weekly synthetic is BYTE-IDENTICAL to the pre-P3.5 call", () => {
    expect(syntheticCandles(DATE, LIMIT)).toEqual(syntheticCandles(DATE, LIMIT, "1w"));
  });

  test("each timeframe is its own deterministic terrain", () => {
    const w = syntheticCandles(DATE, LIMIT, "1w");
    const d = syntheticCandles(DATE, LIMIT, "1d");
    const h4 = syntheticCandles(DATE, LIMIT, "4h");
    const h1 = syntheticCandles(DATE, LIMIT, "1h");
    expect(d).not.toEqual(w);
    expect(h4).not.toEqual(w);
    expect(h1).not.toEqual(w);
    // determinism: same date+interval ⇒ identical candles
    expect(syntheticCandles(DATE, LIMIT, "4h")).toEqual(h4);
    // spacing honors the interval step (timestamps advance uniformly)
    const step = INTERVAL_MS["1h"];
    const hourly = syntheticCandles(DATE, 10, "1h");
    for (let i = 1; i < 10; i++) expect(hourly[i].t - hourly[i - 1].t).toBe(step);
  });
});

describe("P3.5 run-token binds the timeframe", () => {
  test("roundtrip: interval survives sign -> verify", () => {
    const tok = signRunToken(SYMBOL, DATE, 220, CANDLE_JSON, "4h");
    const p = verifyRunToken(tok) as RunTokenPayload;
    expect(p.interval).toBe("4h");
    // different tfs of the same terrain mint DIFFERENT tokens (no cross-play)
    expect(signRunToken(SYMBOL, DATE, 220, CANDLE_JSON, "1h")).not.toBe(tok);
  });

  test("legacy compat: token without interval verifies as 1w", () => {
    // hand-craft a PRE-P3.5 payload (symbol/date/count/h, no interval)
    const legacy = craftToken({
      symbol: SYMBOL,
      date: DATE,
      count: 220,
      h: createHash("sha256").update(CANDLE_JSON).digest("hex").slice(0, 16),
    });
    const p = verifyRunToken(legacy) as RunTokenPayload;
    expect(p).not.toBeNull();
    expect(p.interval).toBe("1w");
  });

  test("forged interval (non-whitelisted) -> null", () => {
    const forged = craftToken({
      symbol: SYMBOL,
      date: DATE,
      count: 220,
      h: "a".repeat(16),
      interval: "2h",
    });
    expect(verifyRunToken(forged)).toBeNull();
  });
});

describe("P3.5 boards never mix timeframes", () => {
  test("memory store isolates per-interval top/rank; legacy entries read as 1w", async () => {
    const s = new MemoryStore();
    const base = { name: "A", score: 100, candlesPassed: 10, symbol: SYMBOL, date: DATE, ts: 1 };
    const legacyWeekly = { ...base, name: "W-LEGACY", score: 300 }; // no interval field
    const weekly = { ...base, name: "W", score: 200, interval: "1w" };
    const hourly = { ...base, name: "H", score: 50, interval: "1h" };
    expect(await s.add(legacyWeekly)).toBe(1); // ranks WITHIN its own tf board
    expect(await s.add(weekly)).toBe(2); // 1w board: legacyWeekly (300) is above 200
    expect(await s.add(hourly)).toBe(1); // 1h board: empty before it

    const wBoard = await s.top(DATE, 50, "1w");
    expect(wBoard.map((e) => e.name)).toEqual(["W-LEGACY", "W"]);
    const hBoard = await s.top(DATE, 50, "1h");
    expect(hBoard.map((e) => e.name)).toEqual(["H"]);
    expect((await s.top(DATE, 50, "4h")).length).toBe(0);
  });

  test("submission stamp: interval pinned from the token, client body ignored", () => {
    const tok: RunTokenPayload = { symbol: SYMBOL, date: DATE, count: 220, h: "a".repeat(16), interval: "4h" };
    const body = {
      name: "B",
      score: 100,
      candlesPassed: 10,
      interval: "1h", // client tries to land on the 1h board
      runToken: "x.y",
    };
    const v = validateSubmission(body, tok, 1234);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.entry.interval).toBe("4h");
  });
});
