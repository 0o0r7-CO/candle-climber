/// <reference types="bun-types" />
// W5 pins for H3 WRECKAGE per-device core (P2.5, bun test, zero deps).
// recordWreck is PURE (immutable db), capped per level, prunes oldest levels;
// wrecks are decor only — this module must never import engine/level/scoring.
import { describe, test, expect } from "bun:test";
import {
  recordWreck,
  wrecksFor,
  MAX_PER_LEVEL,
  MAX_LEVELS,
  type WreckDB,
} from "@/game/cc/wreckage";

const SEED = "2026-09-30BTCUSDT";
const w = (x: number, y: number, ts: number, cause: "fell" | "crumbled" | "wicked" = "fell") => ({ x, y, cause, ts });

describe("W5 recordWreck purity & caps", () => {
  test("returns a NEW db — input never mutated", () => {
    const db: WreckDB = { [SEED]: [w(10, 20, 1)] };
    const before = JSON.stringify(db);
    const out = recordWreck(db, SEED, w(30, 40, 2));
    expect(JSON.stringify(db)).toBe(before);
    expect(out).not.toBe(db);
    expect(out[SEED]).toHaveLength(2);
  });

  test("caps per-level wrecks (oldest dropped, newest kept)", () => {
    let db: WreckDB = {};
    for (let i = 0; i < MAX_PER_LEVEL + 10; i++) {
      db = recordWreck(db, SEED, w(i * 3, 100, i + 1));
    }
    const list = wrecksFor(db, SEED);
    expect(list).toHaveLength(MAX_PER_LEVEL);
    expect(list[0].ts).toBe(11); // first 10 pruned
    expect(list[list.length - 1].ts).toBe(MAX_PER_LEVEL + 10);
  });

  test("prunes oldest LEVELS beyond MAX_LEVELS (by latest fatal ts)", () => {
    let db: WreckDB = {};
    for (let i = 0; i < MAX_LEVELS; i++) {
      db = recordWreck(db, `level-${String(i).padStart(3, "0")}`, w(0, 0, i + 1));
    }
    expect(Object.keys(db)).toHaveLength(MAX_LEVELS);
    // a 25th death on an EXISTING level does not grow the level count -> no eviction
    db = recordWreck(db, "level-000", w(1, 1, 9999));
    expect(Object.keys(db)).toHaveLength(MAX_LEVELS);
    expect(db["level-000"]).toHaveLength(2);
    // a death on a NEW level evicts the stalest level (lowest latest ts —
    // level-000 was refreshed to ts 9999 above, so level-001 (ts 2) is stalest)
    db = recordWreck(db, "level-024", w(2, 2, 25));
    expect(Object.keys(db)).toHaveLength(MAX_LEVELS);
    expect(db["level-024"]).toBeDefined();
    expect(db["level-001"]).toBeUndefined(); // stalest, evicted
    expect(db["level-002"]).toBeDefined(); // next-stalest survives
  });

  test("rejects non-finite coordinates (never stores garbage)", () => {
    const db: WreckDB = {};
    expect(recordWreck(db, SEED, w(Number.NaN, 5, 1))).toBe(db);
    expect(recordWreck(db, SEED, w(5, Number.POSITIVE_INFINITY, 1))).toBe(db);
    expect(recordWreck(db, SEED, null as never)).toBe(db);
    expect(wrecksFor(db, SEED)).toHaveLength(0);
  });

  test("wrecksFor is safe on missing/empty db", () => {
    expect(wrecksFor({}, SEED)).toEqual([]);
    expect(wrecksFor(undefined as never, SEED)).toEqual([]);
  });
});
