/// <reference types="bun-types" />
// P7.1 rival bot — personality mapping, pure jump planner, headless driver.
// All tests are deterministic (fixed-timestep steps, no timers, no randomness).
// Red lines pinned here:
//  - the four spec-mandated personalities (venom/cop/bull/frost) map exactly;
//  - the planner is PURE (no input mutation, byte-identical on re-runs);
//  - the bot replays the SAME deterministic level build (no generation fork);
//  - ZERO INFRA: rival modules contain no network calls of any kind.
import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { personalityForCharId, DEFAULT_PERSONALITY } from "@/game/cc/rival/personality";
import {
  evalPressNow, shouldPress, wantRush, slopTicks, FIXED_DT, PANIC_TICKS,
  type BotSnapshot, type PressEval,
} from "@/game/cc/rival/planner";
import { RivalBot, pickRivalCharId, rivalVerdict } from "@/game/cc/rival/bot";
import { RIVAL_ALPHA } from "@/game/cc/rival/rival-render";
import { BASE_MODS } from "@/game/cc/mutations";
import { buildPlatforms, PLATFORM_W, CANDLE_W } from "@/game/cc/level";
import { PLAYER_W, PLAYER_H } from "@/game/cc/engine";
import { syntheticCandles } from "@/game/cc/level-source";
import { CHARACTERS } from "@/game/cc/characters";
import type { Platform } from "@/game/cc/types";

const SEED = "2026-01-16TESTUSDT";

/** Synthetic solid platform at candle index i, top y. */
function plat(i: number, y = 0, over: Partial<Platform> = {}): Platform {
  return {
    i, x: i * CANDLE_W, w: PLATFORM_W, y,
    bodyTop: y + 12, bodyBottom: y + 54, wickTop: y - 10, wickBottom: y + 76,
    up: true, crumble: false, state: "solid", crumbleT: 0, passed: false,
    ...over,
  };
}

/** Snapshot standing on plats[idx], left-of-center, mid-run speed curve. */
function snapOver(plats: Platform[], idx: number, over: Partial<BotSnapshot> = {}): BotSnapshot {
  const p = plats[idx];
  return {
    px: p.x + 20, py: p.y - PLAYER_H, vy: 0,
    grounded: true, groundIdx: idx,
    time: 20, rush: false, sinceLand: 1,
    ...over,
  };
}

const okEval = (over: Partial<PressEval> = {}): PressEval => ({
  ok: true, landIdx: 5, alignment: 0.9, margin: 20, ticksToLand: 30, risky: false, ...over,
});
const failEval = (): PressEval => ({
  ok: false, landIdx: -1, alignment: 0, margin: 0, ticksToLand: 96, risky: false,
});

describe("P7.1 personality mapping (spec anchors)", () => {
  test("venom => reckless (high risk, sloppy, impatient)", () => {
    const p = personalityForCharId("wickvenom");
    expect(p.label).toBe("RECKLESS");
    expect(p.risk).toBeGreaterThanOrEqual(0.8);
    expect(p.precision).toBeLessThanOrEqual(0.2);
    expect(p.sloppiness).toBeGreaterThanOrEqual(0.8);
    expect(p.patienceS).toBeLessThanOrEqual(0.01);
  });

  test("cop => precise (waits for optimal alignment, zero sloppiness)", () => {
    const p = personalityForCharId("wickcop");
    expect(p.label).toBe("PRECISE");
    expect(p.precision).toBeGreaterThanOrEqual(0.8);
    expect(p.sloppiness).toBe(0);
  });

  test("bull => greedy (rushes hard, short safety margins)", () => {
    const p = personalityForCharId("goldenbull");
    expect(p.label).toBe("GREEDY");
    expect(p.greed).toBeGreaterThanOrEqual(0.9);
    expect(wantRush(p)).toBe(true);
    expect(p.risk).toBeGreaterThanOrEqual(0.6);
  });

  test("frost => patient (delays jumps, never rushes, conservative)", () => {
    const p = personalityForCharId("frostliquidator");
    expect(p.label).toBe("PATIENT");
    expect(p.patienceS).toBeGreaterThanOrEqual(0.15);
    expect(p.greed).toBe(0);
    expect(wantRush(p)).toBe(false);
    expect(p.risk).toBeLessThanOrEqual(0.3);
  });

  test("every roster character maps with parameters clamped to 0..1", () => {
    for (const c of CHARACTERS) {
      const p = personalityForCharId(c.id);
      for (const k of ["risk", "precision", "greed", "patienceS", "sloppiness"] as const) {
        expect(p[k]).toBeGreaterThanOrEqual(0);
        expect(p[k]).toBeLessThanOrEqual(1);
      }
      expect(p.label.length).toBeGreaterThan(0);
    }
  });

  test("unknown character falls back to the balanced default (pure lookup)", () => {
    const p = personalityForCharId("no-such-char");
    expect(p.risk).toBe(DEFAULT_PERSONALITY.risk);
    expect(p.label).toBe(DEFAULT_PERSONALITY.label);
    expect(personalityForCharId("default").label).toBe("BALANCED");
  });
});

describe("P7.1 jump planner — feasibility (pure forward simulation)", () => {
  test("flat runway: a full-hold press lands ahead, well-centered", () => {
    const plats = Array.from({ length: 20 }, (_, i) => plat(i));
    const s = snapOver(plats, 2);
    const ev = evalPressNow(s, plats, BASE_MODS, false);
    expect(ev.full.ok).toBe(true);
    expect(ev.full.landIdx).toBeGreaterThan(2);
    expect(ev.full.alignment).toBeGreaterThan(0.5);
    expect(ev.full.ticksToLand).toBeLessThan(96);
    // cut variant also lands ahead on flats (short hop)
    expect(ev.cut.ok).toBe(true);
    expect(ev.cut.landIdx).toBeGreaterThan(2);
  });

  test("gap lookahead: the rollout clears a one-candle gap to the far side", () => {
    const plats = [
      plat(0), plat(1), plat(2),
      plat(3, 0, { w: 0, state: "gone" as const, up: false }), // the gap
      plat(4), plat(5), plat(6),
    ];
    const s = snapOver(plats, 1);
    const ev = evalPressNow(s, plats, BASE_MODS, false);
    expect(ev.full.ok).toBe(true);
    expect(ev.full.landIdx).toBeGreaterThanOrEqual(4); // beyond the gap
  });

  test("jump-feasibility check: an impossible +400px wall is rejected", () => {
    const plats = [plat(0), plat(1), plat(2), plat(3, -400), plat(4, -800)];
    const s = snapOver(plats, 2);
    const ev = evalPressNow(s, plats, BASE_MODS, false);
    expect(ev.full.ok).toBe(false);
    expect(ev.cut.ok).toBe(false);
  });

  test("risky targets are flagged (red candle = crumble on touch)", () => {
    const plats = [
      plat(0), plat(1), plat(2),
      plat(3, 0, { up: false, crumble: true }),
      plat(4), plat(5),
    ];
    const s = snapOver(plats, 2);
    const ev = evalPressNow(s, plats, BASE_MODS, false);
    const riskyEval = [ev.full, ev.cut].find((c) => c.ok && c.landIdx === 3);
    if (riskyEval) expect(riskyEval.risky).toBe(true);
  });

  test("purity: evaluation never mutates the snapshot or the platforms", () => {
    const plats = Array.from({ length: 12 }, (_, i) => plat(i));
    const s = snapOver(plats, 3);
    const platsBefore = JSON.stringify(plats);
    const snapBefore = JSON.stringify(s);
    evalPressNow(s, plats, BASE_MODS, true);
    expect(JSON.stringify(plats)).toBe(platsBefore);
    expect(JSON.stringify(s)).toBe(snapBefore);
  });

  test("determinism: identical snapshots produce byte-identical evaluations", () => {
    const plats = Array.from({ length: 12 }, (_, i) => plat(i, i % 2 === 0 ? 0 : -40));
    const a = evalPressNow(snapOver(plats, 2), plats, BASE_MODS, false);
    const b = evalPressNow(snapOver(plats, 2), plats, BASE_MODS, false);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("P7.1 jump planner — personality-gated decisions", () => {
  const s = snapOver(Array.from({ length: 12 }, (_, i) => plat(i)), 2);

  test("precision gate: cop declines an edge landing, accepts a centered one", () => {
    const cop = personalityForCharId("wickcop");
    const sloppy = { full: okEval({ alignment: 0.2, margin: 20 }), cut: failEval() };
    expect(shouldPress(s, sloppy, cop, 50).press).toBe(false);
    const centered = { full: okEval({ alignment: 0.9, margin: 20 }), cut: failEval() };
    expect(shouldPress(s, centered, cop, 50).press).toBe(true);
  });

  test("risk gate: venom accepts a 6px margin that cop refuses", () => {
    const venom = personalityForCharId("wickvenom");
    const cop = personalityForCharId("wickcop");
    const tight = { full: okEval({ alignment: 0.9, margin: 6 }), cut: failEval() };
    expect(shouldPress(s, tight, venom, 50).press).toBe(true);
    expect(shouldPress(s, tight, cop, 50).press).toBe(false);
  });

  test("patience gate: frost delays the press after landing — panic overrides", () => {
    const frost = personalityForCharId("frostliquidator");
    const good = { full: okEval(), cut: failEval() };
    const early = { ...s, sinceLand: 0.05 };
    const late = { ...s, sinceLand: frost.patienceS + 0.01 };
    expect(shouldPress(early, good, frost, 50).press).toBe(false);
    expect(shouldPress(late, good, frost, 50).press).toBe(true);
    // survival beats style: near the edge the bot presses regardless
    expect(shouldPress(early, good, frost, PANIC_TICKS).press).toBe(true);
  });

  test("panic: with no feasible landing the bot still jumps (goes out trying)", () => {
    const cop = personalityForCharId("wickcop");
    const doomed = { full: failEval(), cut: failEval() };
    const d = shouldPress(s, doomed, cop, PANIC_TICKS);
    expect(d.press).toBe(true);
    // and away from the deadline it holds fire instead of suiciding
    expect(shouldPress(s, doomed, cop, 50).press).toBe(false);
  });

  test("greed: rush policy follows the greed knob", () => {
    expect(wantRush(personalityForCharId("goldenbull"))).toBe(true);
    expect(wantRush(personalityForCharId("frostliquidator"))).toBe(false);
  });

  test("sloppiness: deterministic per (seed, landing), within ±3 ticks", () => {
    const wild = personalityForCharId("cowboy-sheet"); // sloppiness 1
    const a = slopTicks(SEED, 7, wild);
    const b = slopTicks(SEED, 7, wild);
    expect(a).toBe(b);
    expect(Math.abs(a)).toBeLessThanOrEqual(3);
    // zero sloppiness never deviates (cop executes exactly)
    expect(slopTicks(SEED, 7, personalityForCharId("wickcop"))).toBe(0);
  });
});

describe("P7.1 rival bot — headless driver (fixed-timestep integration)", () => {
  const candles = syntheticCandles("2026-01-16", 220, "1w");
  const DT = FIXED_DT;

  test("the bot replays the SAME deterministic level build (no generation fork)", () => {
    const bot = new RivalBot(candles, SEED, "wickcop", BASE_MODS);
    expect(JSON.stringify(bot.eng.plats)).toBe(JSON.stringify(buildPlatforms(candles, SEED)));
  });

  test("60s of fixed steps on synthetic terrain makes real climbing progress", () => {
    const bot = new RivalBot(candles, SEED, "wickcop", BASE_MODS);
    for (let i = 0; i < 3600; i++) bot.tick(DT); // one simulated minute
    expect(bot.bestCandles).toBeGreaterThanOrEqual(8);
    expect(bot.attempts).toBeGreaterThanOrEqual(1);
    expect(bot.attempts).toBeLessThanOrEqual(2); // respawn cap never exceeded
  });

  test("bot runs are deterministic: two identical bots stay byte-equal", () => {
    const a = new RivalBot(candles, SEED, "goldenbull", BASE_MODS);
    const b = new RivalBot(candles, SEED, "goldenbull", BASE_MODS);
    for (let i = 0; i < 1800; i++) { a.tick(DT); b.tick(DT); }
    expect(b.bestCandles).toBe(a.bestCandles);
    expect(b.bestScore).toBe(a.bestScore);
    expect(b.attempts).toBe(a.attempts);
    expect(b.eng.camX).toBe(a.eng.camX);
    expect(b.eng.py).toBe(a.eng.py);
  });

  test("respawn cap: cold restart once, then the rival stops for good", () => {
    const bot = new RivalBot(candles, SEED, "wickcop", BASE_MODS);
    bot.eng.dead = true; // force attempt-1 death (white-box; physics covered above)
    bot.tick(DT);
    expect(bot.attempts).toBe(2);
    expect(bot.stopped).toBe(false);
    expect(bot.eng.dead).toBe(false); // fresh cold engine from candle 0
    expect(bot.candles).toBe(0);
    bot.eng.dead = true; // second death
    bot.tick(DT);
    expect(bot.stopped).toBe(true);
    const frozenCam = bot.eng.camX;
    bot.tick(DT); // no-op after stopping
    expect(bot.stopped).toBe(true);
    expect(bot.eng.camX).toBe(frozenCam);
  });

  test("rival skin: deterministic per seed and always a skinned character", () => {
    const id = pickRivalCharId(SEED);
    expect(id).toBe(pickRivalCharId(SEED));
    const def = CHARACTERS.find((c) => c.id === id);
    expect(def).toBeDefined();
    expect(def?.sheet).toBeTruthy();
  });

  test("ghost alpha stays inside the spec band (0.45–0.6)", () => {
    expect(RIVAL_ALPHA).toBeGreaterThanOrEqual(0.45);
    expect(RIVAL_ALPHA).toBeLessThanOrEqual(0.6);
  });
});

describe("P7.1 verdict + zero-infra red lines", () => {
  test("verdict lines match the spec format exactly", () => {
    expect(rivalVerdict(61, 43).line).toBe("YOU WON — RIVAL 43 / YOU 61");
    expect(rivalVerdict(61, 43).won).toBe(true);
    expect(rivalVerdict(43, 61).line).toBe("RIVAL WINS — RIVAL 61 / YOU 43");
    expect(rivalVerdict(43, 61).won).toBe(false);
    expect(rivalVerdict(30, 30).line).toBe("DEAD HEAT — RIVAL 30 / YOU 30");
    expect(rivalVerdict(30, 30).tie).toBe(true);
  });

  test("zero infra: rival modules make no network calls of any kind", () => {
    const dir = join(import.meta.dir, "..", "src", "game", "cc", "rival");
    for (const f of ["bot.ts", "planner.ts", "personality.ts", "rival-render.ts"]) {
      const src = readFileSync(join(dir, f), "utf8");
      expect(src).not.toMatch(/\bfetch\s*\(/);
      expect(src).not.toMatch(/XMLHttpRequest/);
      expect(src).not.toMatch(/WebSocket/);
      expect(src).not.toMatch(/sendBeacon/);
      expect(src).not.toMatch(/\/api\//); // no route calls, leaderboard included
    }
  });
});
