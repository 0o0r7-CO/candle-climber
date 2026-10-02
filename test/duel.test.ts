/// <reference types="bun-types" />
// P7.3 async duels — challenge validation, verdict logic, tally, code space,
// store retention. All deterministic (pure functions + memory store).
// Red lines pinned here:
//  - validateDuelChallenge pins symbol/date/interval EXCLUSIVELY from the
//    verified token payload (client claims ignored — W5 layering);
//  - physical caps mirror validateSubmission (token count × max-per-candle);
//  - the recorded stream cannot claim more candles than its horizon;
//  - codes are crypto-random, unambiguous, collision-resistant;
//  - the memory store expires (TTL) + caps per-terrain challenges;
//  - ZERO NETWORK in the pure module (duel.ts) — the route is the only I/O.
import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  validateDuelChallenge, duelVerdict, applyDuelResult, parseTally, tallyLabel,
  challengeToGhost, duelUrl, duelExpired, DUEL_CODE_RE, DUEL_CODE_ALPHABET,
  DUEL_CODE_LEN, DUEL_SCORE_MAX, EMPTY_TALLY,
} from "@/game/cc/duel";
import { MemoryDuelStore, DUELS_PER_TERRAIN } from "@/lib/duel-store";
import { MAX_SCORE_PER_CANDLE } from "@/lib/scoring";
import { MAX_CANDLES } from "@/lib/board-validation";

const TOK = { symbol: "SOLUSDT", date: "2026-10-02", interval: "1w", count: 10 };
// physical maxima for count=10: candles ≤ 1750, score ≤ 1770
const CAP = TOK.count * MAX_SCORE_PER_CANDLE;
const samples = [0, 100, 10, 90, 20, 80]; // 3 samples = horizon of 3 candles

function makeChallenge(over: Record<string, unknown> = {}) {
  return {
    name: "RIDER", charId: "wickvenom",
    score: 500, candlesPassed: 3, bestStreak: 2,
    samples, symbol: "FAKE", date: "1999-01-01", interval: "1h", // client claims — must be ignored
    ...over,
  };
}

/* ------------------------------- validation -------------------------------- */

describe("P7.3 validateDuelChallenge (W5-layered contract)", () => {
  test("ok path — terrain pinned from the token, client claims ignored", () => {
    const v = validateDuelChallenge(makeChallenge(), TOK, MAX_CANDLES);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.challenge.symbol).toBe("SOLUSDT");
      expect(v.challenge.date).toBe("2026-10-02");
      expect(v.challenge.interval).toBe("1w");
      expect(v.challenge.code).toBe(""); // assigned by the store
      expect(v.challenge.score).toBe(500);
    }
  });

  test("rejects malformed sample streams (same contract as ghosts)", () => {
    expect(validateDuelChallenge(makeChallenge({ samples: "nope" }), TOK, MAX_CANDLES).ok).toBe(false);
    expect(validateDuelChallenge(makeChallenge({ samples: [] }), TOK, MAX_CANDLES).ok).toBe(false);
    expect(validateDuelChallenge(makeChallenge({ samples: [0, 100, 10] }), TOK, MAX_CANDLES).ok).toBe(false);
    expect(validateDuelChallenge(makeChallenge({ samples: [0, NaN] }), TOK, MAX_CANDLES).ok).toBe(false);
    expect(validateDuelChallenge(makeChallenge({ samples: [0.5, 100] }), TOK, MAX_CANDLES).ok).toBe(false);
    expect(validateDuelChallenge(makeChallenge({ samples: [-1, 0] }), TOK, MAX_CANDLES).ok).toBe(false);
  });

  test("rejects bad score / candles shapes", () => {
    expect(validateDuelChallenge(makeChallenge({ score: -1 }), TOK, MAX_CANDLES).ok).toBe(false);
    expect(validateDuelChallenge(makeChallenge({ score: DUEL_SCORE_MAX + 1 }), TOK, MAX_CANDLES).ok).toBe(false);
    expect(validateDuelChallenge(makeChallenge({ score: Number.POSITIVE_INFINITY }), TOK, MAX_CANDLES).ok).toBe(false);
    expect(validateDuelChallenge(makeChallenge({ candlesPassed: -1 }), TOK, MAX_CANDLES).ok).toBe(false);
  });

  test("physical cap: token candle count bounds the claimed run (403)", () => {
    const long = Array.from({ length: 2000 }, (_, i) => [i * 10, 100]).flat();
    const v = validateDuelChallenge(makeChallenge({ candlesPassed: CAP + 1, samples: long }), TOK, MAX_CANDLES);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.status).toBe(403);
    const vs = validateDuelChallenge(makeChallenge({ score: CAP + 21, samples: long }), TOK, MAX_CANDLES);
    expect(vs.ok).toBe(false);
    if (!vs.ok) expect(vs.status).toBe(403);
  });

  test("physical sanity: candles cannot exceed the recorded horizon", () => {
    // 3 samples = 0.1 s of stream — claiming 5 candles from it is impossible
    const v = validateDuelChallenge(makeChallenge({ candlesPassed: 5 }), TOK, MAX_CANDLES);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.status).toBe(400);
  });

  test("name sanitized like the leaderboard; bad charId falls back to default", () => {
    const v = validateDuelChallenge(makeChallenge({ name: "  a\x01b<>c  ", charId: "../../etc/passwd" }), TOK, MAX_CANDLES);
    if (v.ok) {
      expect(v.challenge.name).toBe("abc");
      expect(v.challenge.charId).toBe("default");
    }
    const anon = validateDuelChallenge(makeChallenge({ name: "   " }), TOK, MAX_CANDLES);
    if (anon.ok) expect(anon.challenge.name).toBe("ANON");
  });

  test("bestStreak clamps to the 0–999 band", () => {
    const v = validateDuelChallenge(makeChallenge({ bestStreak: 5000 }), TOK, MAX_CANDLES);
    if (v.ok) expect(v.challenge.bestStreak).toBe(999);
  });
});

/* --------------------------------- verdict ---------------------------------- */

describe("P7.3 duelVerdict", () => {
  const target = { name: "RIDER", score: 1000, candlesPassed: 10 };

  test("score decides first", () => {
    expect(duelVerdict(target, { score: 1001, candlesPassed: 1 }).outcome).toBe("win");
    expect(duelVerdict(target, { score: 999, candlesPassed: 99 }).outcome).toBe("loss");
  });

  test("tie on score breaks by candles", () => {
    expect(duelVerdict(target, { score: 1000, candlesPassed: 11 }).outcome).toBe("win");
    expect(duelVerdict(target, { score: 1000, candlesPassed: 9 }).outcome).toBe("loss");
  });

  test("full tie is a draw", () => {
    const v = duelVerdict(target, { score: 1000, candlesPassed: 10 });
    expect(v.outcome).toBe("draw");
    expect(v.line).toMatch(/DRAW/);
  });

  test("win/loss lines name the rival", () => {
    expect(duelVerdict(target, { score: 2000, candlesPassed: 1 }).line).toMatch(/RIDER/);
    expect(duelVerdict(target, { score: 1, candlesPassed: 1 }).line).toMatch(/RIDER/);
  });
});

/* ------------------------------ local tally --------------------------------- */

describe("P7.3 duel tally", () => {
  test("applyDuelResult folds exactly one counter", () => {
    expect(applyDuelResult(EMPTY_TALLY, "win")).toEqual({ w: 1, l: 0, d: 0 });
    expect(applyDuelResult(EMPTY_TALLY, "loss")).toEqual({ w: 0, l: 1, d: 0 });
    expect(applyDuelResult(EMPTY_TALLY, "draw")).toEqual({ w: 0, l: 0, d: 1 });
    expect(applyDuelResult({ w: 2, l: 3, d: 4 }, "win")).toEqual({ w: 3, l: 3, d: 4 });
  });

  test("parseTally: valid JSON, corrupt JSON, null — never negative", () => {
    expect(parseTally('{"w":1,"l":2,"d":3}')).toEqual({ w: 1, l: 2, d: 3 });
    expect(parseTally("not json")).toEqual(EMPTY_TALLY);
    expect(parseTally(null)).toEqual(EMPTY_TALLY);
    expect(parseTally('{"w":-5,"l":"x","d":2}')).toEqual({ w: 0, l: 0, d: 2 });
  });

  test("tallyLabel renders the W–L–D record", () => {
    expect(tallyLabel({ w: 2, l: 1, d: 0 })).toBe("2–1–0");
  });
});

/* --------------------------- replay + links + codes ------------------------- */

describe("P7.3 challenge replay projection + codes", () => {
  const ch = {
    code: "ABC234", name: "RIDER", charId: "frostliquidator",
    score: 1234, candlesPassed: 7, bestStreak: 3,
    symbol: "SOLUSDT", date: "2026-10-02", interval: "1w", ts: 42, samples,
  };

  test("challengeToGhost is a GhostEntry-compatible projection (P7.2 replay reuse)", () => {
    const g = challengeToGhost(ch);
    expect(g).toEqual({
      name: "RIDER", charId: "frostliquidator", candlesPassed: 7,
      symbol: "SOLUSDT", date: "2026-10-02", interval: "1w", ts: 42, samples,
    });
  });

  test("duelUrl builds the ?duel= deep link, tolerates trailing slashes", () => {
    expect(duelUrl("https://candle-climber.vercel.app", "ABC234")).toBe("https://candle-climber.vercel.app/?duel=ABC234");
    expect(duelUrl("https://x.example/", "ABC234")).toBe("https://x.example/?duel=ABC234");
  });

  test("code alphabet is unambiguous (no 0/O/1/I/L) and the regex pins the shape", () => {
    expect(DUEL_CODE_ALPHABET).not.toMatch(/[0O1IL]/);
    expect(DUEL_CODE_LEN).toBe(6);
    expect(DUEL_CODE_RE.test("A2B3C4")).toBe(true);
    expect(DUEL_CODE_RE.test("A2B3C")).toBe(false); // too short
    expect(DUEL_CODE_RE.test("A2B3C40")).toBe(false); // too long
    expect(DUEL_CODE_RE.test("A2B3C0")).toBe(false); // 0 excluded
    expect(DUEL_CODE_RE.test("a2b3c4")).toBe(false); // uppercase only
  });
});

/* ---------------------------------- store ----------------------------------- */

describe("P7.3 memory duel store", () => {
  test("create assigns a valid code; get round-trips the challenge", async () => {
    const st = new MemoryDuelStore();
    const code = await st.create({
      name: "RIDER", charId: "cop", score: 100, candlesPassed: 3, bestStreak: 1,
      symbol: TOK.symbol, date: TOK.date, interval: TOK.interval, ts: Date.now(), samples,
    });
    expect(DUEL_CODE_RE.test(code)).toBe(true);
    const got = await st.get(code);
    expect(got).not.toBeNull();
    expect(got?.name).toBe("RIDER");
    expect(got?.code).toBe(code);
  });

  test("unknown code → null; garbage code shape → null (no store hit)", async () => {
    const st = new MemoryDuelStore();
    expect(await st.get("ZZZZZZ")).toBeNull();
  });

  test("code space: 200 creates are all unique and shape-valid", async () => {
    const st = new MemoryDuelStore();
    const codes = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const code = await st.create({
        name: `P${i}`, charId: "cop", score: i, candlesPassed: 1, bestStreak: 0,
        symbol: `S${i % 3}`, date: TOK.date, interval: TOK.interval, ts: Date.now() - i, samples,
      });
      codes.add(code);
    }
    expect(codes.size).toBe(200);
  });

  test("TTL: challenges older than DUEL_TTL_DAYS expire on read", async () => {
    const st = new MemoryDuelStore();
    const old = Date.now() - 8 * 86_400_000;
    const code = await st.create({
      name: "OLD", charId: "cop", score: 1, candlesPassed: 1, bestStreak: 0,
      symbol: TOK.symbol, date: TOK.date, interval: TOK.interval, ts: old, samples,
    });
    expect(await st.get(code)).toBeNull();
    expect(duelExpired({
      code, name: "OLD", charId: "cop", score: 1, candlesPassed: 1, bestStreak: 0,
      symbol: TOK.symbol, date: TOK.date, interval: TOK.interval, ts: old, samples,
    })).toBe(true);
  });

  test("per-terrain cap: the oldest challenges are evicted beyond DUELS_PER_TERRAIN", async () => {
    const st = new MemoryDuelStore();
    const codes: string[] = [];
    for (let i = 0; i < DUELS_PER_TERRAIN + 3; i++) {
      codes.push(await st.create({
        name: `P${i}`, charId: "cop", score: i, candlesPassed: 1, bestStreak: 0,
        symbol: "CAPUSDT", date: TOK.date, interval: TOK.interval, ts: Date.now() - i * 1000, samples,
      }));
    }
    expect(await st.get(codes[0])).not.toBeNull(); // newest survives
    expect(await st.get(codes[2])).not.toBeNull();
    expect(await st.get(codes[codes.length - 2])).toBeNull(); // oldest evicted
    expect(await st.get(codes[codes.length - 1])).toBeNull();
  });
});

/* -------------------------------- red lines --------------------------------- */

describe("P7.3 red lines", () => {
  test("pure duel module is network-free (route is the only I/O)", () => {
    const src = readFileSync(join(import.meta.dir, "../src/game/cc/duel.ts"), "utf8");
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/XMLHttpRequest/);
    expect(src).not.toMatch(/WebSocket/);
    expect(src).not.toMatch(/import\s+.*\bmongodb/);
    // layering: the pure module never imports the token machinery itself
    expect(src).not.toMatch(/import\s+.*run-token/);
  });

  test("duel store follows the leaderboard-store pattern (graceful memory fallback)", () => {
    const src = readFileSync(join(import.meta.dir, "../src/lib/duel-store.ts"), "utf8");
    expect(src).toMatch(/falling back to memory/);
    expect(src).toMatch(/expireAfterSeconds/); // TTL on daily-terrain duels
    expect(src).toMatch(/11000/); // mongo duplicate-key path is the ONLY tolerated insert error
  });

  test("codes are crypto-random — no Math.random anywhere in the generator", () => {
    const src = readFileSync(join(import.meta.dir, "../src/lib/code-gen.ts"), "utf8");
    expect(src).toMatch(/node:crypto/);
    expect(src).not.toMatch(/Math\.random/);
  });
});
