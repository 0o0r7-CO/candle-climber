/// <reference types="bun-types" />
// P7.2 ghost runs — recorder cadence, replay sampling, validation contract,
// store retention. All tests are deterministic (pure functions + memory store).
// Red lines pinned here:
//  - the recorder samples at exactly GHOST_HZ (every 2nd fixed tick) and caps
//    at MAX_GHOST_SAMPLES (world-2 marathons cannot bloat the store);
//  - validateGhost pins symbol/date/interval EXCLUSIVELY from the verified
//    token payload (client claims ignored — same layering as validateSubmission);
//  - physical sanity: candles cannot exceed the recorded horizon;
//  - the memory store keeps the best GHOSTS_PER_TERRAIN per terrain key;
//  - ZERO NETWORK in the pure module (ghost.ts) — the route is the only I/O.
import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  GhostRecorder, ghostViewAt, bestGhost, validateGhost,
  GHOST_HZ, MAX_GHOST_SAMPLES, GHOSTS_PER_TERRAIN, GHOST_X_MAX,
  type GhostEntry,
} from "@/game/cc/ghost";
import { MemoryGhostStore, ghostKey, GHOST_TTL_DAYS } from "@/lib/ghost-store";

const TOK = { symbol: "SOLUSDT", date: "2026-10-02", interval: "1w" };

function makeEntry(over: Partial<GhostEntry> = {}): GhostEntry {
  return {
    name: "RIDER",
    charId: "wickvenom",
    candlesPassed: 12,
    symbol: TOK.symbol,
    date: TOK.date,
    interval: TOK.interval,
    ts: 1_770_000_000_000,
    samples: [0, 0, 100, 40, 200, 80],
    ...over,
  };
}

/* ------------------------------- recorder ---------------------------------- */

describe("P7.2 ghost recorder", () => {
  test("samples every 2nd fixed tick (GHOST_HZ = 30 at 1/60)", () => {
    const r = new GhostRecorder();
    r.start();
    for (let i = 0; i < 60; i++) r.tick(1000 + i, 200); // 1 second of ticks
    expect(r.count).toBe(30);
    const s = r.flush();
    expect(s.length).toBe(60);
    expect(s[0]).toBe(1000); // first recorded tick is t=0
    expect(s[2]).toBe(1002); // second sample is the 3rd tick (every 2nd)
  });

  test("flush returns a snapshot — later ticks do not mutate it", () => {
    const r = new GhostRecorder();
    r.start();
    r.tick(1, 2);
    r.tick(3, 4);
    const snap = r.flush();
    r.tick(5, 6);
    expect(snap.length).toBe(2);
    expect(r.flush().length).toBe(4);
  });

  test("inactive recorder records nothing; start() resets", () => {
    const r = new GhostRecorder();
    r.tick(1, 2);
    expect(r.count).toBe(0);
    r.start();
    r.tick(7, 8);
    expect(r.flush()).toEqual([7, 8]);
    r.start();
    expect(r.count).toBe(0);
  });

  test("hard cap: recording stops at MAX_GHOST_SAMPLES (world-2 marathons)", () => {
    const r = new GhostRecorder();
    r.start();
    for (let i = 0; i < MAX_GHOST_SAMPLES * 4; i++) r.tick(i % GHOST_X_MAX, 0);
    expect(r.count).toBe(MAX_GHOST_SAMPLES);
    expect(r.flush().length).toBe(MAX_GHOST_SAMPLES * 2);
  });

  test("samples are rounded to integers", () => {
    const r = new GhostRecorder();
    r.start();
    r.tick(10.6, 20.4);
    expect(r.flush()).toEqual([11, 20]);
  });
});

/* ------------------------------ replay lookup ------------------------------ */

describe("P7.2 ghost replay", () => {
  const g = makeEntry({ samples: [0, 100, 10, 90, 20, 80] }); // 3 samples @30Hz

  test("index lookup by the replaying engine's own clock", () => {
    expect(ghostViewAt(g, 0)).toMatchObject({ x: 0, y: 100, frozen: false });
    expect(ghostViewAt(g, 1 / 30)).toMatchObject({ x: 10, y: 90 });
    expect(ghostViewAt(g, 2 / 30)).toMatchObject({ x: 20, y: 80 });
  });

  test("past the stream end the ghost freezes at its last position", () => {
    const v = ghostViewAt(g, 999);
    expect(v).toMatchObject({ x: 20, y: 80, frozen: true });
  });

  test("negative time clamps to the first sample", () => {
    expect(ghostViewAt(g, -5)).toMatchObject({ x: 0, y: 100 });
  });

  test("empty stream renders nothing", () => {
    expect(ghostViewAt(makeEntry({ samples: [] }), 0)).toBeNull();
  });

  test("bestGhost picks the highest climb", () => {
    const a = makeEntry({ candlesPassed: 3 });
    const b = makeEntry({ candlesPassed: 9 });
    expect(bestGhost([a, b])).toBe(b);
    expect(bestGhost([])).toBeNull();
  });
});

/* ------------------------------- validation -------------------------------- */

describe("P7.2 validateGhost (W5-layered contract)", () => {
  const samples = [0, 100, 10, 90, 20, 80]; // 3 samples, 2 candles claimable

  test("ok path — terrain pinned from the token, client claims ignored", () => {
    const v = validateGhost(
      { name: "ZED", charId: "frost", candlesPassed: 2, samples,
        symbol: "FAKE", date: "1999-01-01", interval: "1h" },
      TOK,
    );
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.entry.symbol).toBe("SOLUSDT");
      expect(v.entry.date).toBe("2026-10-02");
      expect(v.entry.interval).toBe("1w");
      expect(v.entry.samples).toEqual(samples);
    }
  });

  test("rejects: non-array, odd length, non-finite, non-integer, over-cap, out-of-bounds", () => {
    expect(validateGhost({ samples: "nope", candlesPassed: 1 }, TOK).ok).toBe(false);
    expect(validateGhost({ samples: [0, 100, 10], candlesPassed: 1 }, TOK).ok).toBe(false);
    expect(validateGhost({ samples: [0, NaN], candlesPassed: 1 }, TOK).ok).toBe(false);
    expect(validateGhost({ samples: [0.5, 100], candlesPassed: 1 }, TOK).ok).toBe(false);
    expect(
      validateGhost({ samples: new Array(MAX_GHOST_SAMPLES * 2 + 2).fill(0), candlesPassed: 1 }, TOK).ok,
    ).toBe(false);
    expect(validateGhost({ samples: [-1, 0], candlesPassed: 1 }, TOK).ok).toBe(false);
    expect(validateGhost({ samples: [GHOST_X_MAX + 1, 0], candlesPassed: 1 }, TOK).ok).toBe(false);
    expect(validateGhost({ samples: [0, -2001], candlesPassed: 1 }, TOK).ok).toBe(false);
  });

  test("physical sanity: candles cannot exceed the recorded horizon", () => {
    // 3 samples = 0.1 s of stream — claiming 5 candles from it is impossible
    const v = validateGhost({ candlesPassed: 5, samples }, TOK);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.status).toBe(400);
  });

  test("candles cap (MAX_CANDLES) enforced", () => {
    const long = new Array(200).fill(0).flatMap((_, i) => [i * 10, 100]);
    const v = validateGhost({ candlesPassed: 9999, samples: long }, TOK, 5000);
    expect(v.ok).toBe(false);
  });

  test("name sanitized like the leaderboard (control chars stripped, ANON fallback)", () => {
    const v = validateGhost({ candlesPassed: 1, samples, name: "  a\x01b<>c  " }, TOK);
    if (v.ok) expect(v.entry.name).toBe("abc");
    const anon = validateGhost({ candlesPassed: 1, samples, name: "   " }, TOK);
    if (anon.ok) expect(anon.entry.name).toBe("ANON");
  });

  test("bad charId falls back to the default skin, never breaks replay", () => {
    const v = validateGhost({ candlesPassed: 1, samples, charId: "../../etc/passwd" }, TOK);
    if (v.ok) expect(v.entry.charId).toBe("default");
  });
});

/* ---------------------------------- store ---------------------------------- */

describe("P7.2 memory ghost store", () => {
  test("keeps the best GHOSTS_PER_TERRAIN per terrain, serves GHOSTS_SERVED", async () => {
    const st = new MemoryGhostStore();
    for (let i = 0; i < GHOSTS_PER_TERRAIN + 2; i++) {
      await st.add(makeEntry({ name: `P${i}`, candlesPassed: i + 1, ts: 1000 + i }));
    }
    const top = await st.top(TOK.symbol, TOK.date, TOK.interval);
    expect(top.length).toBe(3); // GHOSTS_SERVED
    expect(top[0].candlesPassed).toBe(GHOSTS_PER_TERRAIN + 2); // champion first
    expect(top[0].name).toBe(`P${GHOSTS_PER_TERRAIN + 1}`);
  });

  test("terrain keys never mix (symbol|date|interval)", async () => {
    const st = new MemoryGhostStore();
    await st.add(makeEntry({ name: "A" }));
    await st.add(makeEntry({ name: "B", date: "2026-10-01" }));
    await st.add(makeEntry({ name: "C", interval: "1h" }));
    expect((await st.top(TOK.symbol, TOK.date, "1w")).length).toBe(1);
    expect((await st.top(TOK.symbol, "2026-10-01", "1w")).length).toBe(1);
    expect((await st.top(TOK.symbol, TOK.date, "1h")).length).toBe(1);
    expect(ghostKey("SOLUSDT", "2026-10-02", "1w")).toBe("SOLUSDT|2026-10-02|1w");
  });

  test("tie on candles breaks by earlier ts (first champion keeps the crown)", async () => {
    const st = new MemoryGhostStore();
    await st.add(makeEntry({ name: "FIRST", candlesPassed: 5, ts: 100 }));
    await st.add(makeEntry({ name: "SECOND", candlesPassed: 5, ts: 200 }));
    const top = await st.top(TOK.symbol, TOK.date, TOK.interval);
    expect(top[0].name).toBe("FIRST");
  });

  test("TTL constant is weekly-ish (daily terrains rotate ghosts out)", () => {
    expect(GHOST_TTL_DAYS).toBeGreaterThanOrEqual(3);
    expect(GHOST_TTL_DAYS).toBeLessThanOrEqual(14);
  });
});

/* ------------------------------- red lines --------------------------------- */

describe("P7.2 red lines", () => {
  test("pure ghost module is network-free (route is the only I/O)", () => {
    const src = readFileSync(join(import.meta.dir, "../src/game/cc/ghost.ts"), "utf8");
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/XMLHttpRequest/);
    expect(src).not.toMatch(/WebSocket/);
    expect(src).not.toMatch(/import\s+.*\bmongodb/);
  });

  test("ghost store follows the leaderboard-store pattern (graceful memory fallback)", () => {
    const src = readFileSync(join(import.meta.dir, "../src/lib/ghost-store.ts"), "utf8");
    expect(src).toMatch(/falling back to memory/);
    expect(src).toMatch(/expireAfterSeconds/); // TTL on daily-terrain ghosts
  });
});
