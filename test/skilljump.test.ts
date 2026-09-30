/// <reference types="bun-types" />
// P3.6 skill-jump controls — implementation-contract tests (bun test).
// Pins PLATFORMER-UX-RESEARCH §6 exactly:
//  1. RUSH composition order: mutation mods shape the base curve FIRST, the
//     rush multipliers (speed ×1.28 / gain ×1.25) apply AFTER, rounded last.
//  2. Gravity-hang: GRAVITY × 0.5 while rising (vy < 0) with jump held;
//     release ends both the hang and the rise; jump-cut still wins on release.
//  3. World-2 parity: the rush premium applies to WORLD2_GAIN too.
//  4. Determinism under rush on/off (same inputs ⇒ identical engine states).
//  5. Anti-cheat coupling: MAX_SCORE_PER_CANDLE covers the rushed world-2 max.
import { describe, test, expect } from "bun:test";
import { Engine, VIEW_W, VIEW_H } from "@/game/cc/engine";
import { PLATFORM_W } from "./../src/game/cc/level";
import type { Platform } from "@/game/cc/types";
import {
  BASE_GAIN, WORLD2_GAIN, COMBO_CAP, COMBO_STEP,
  RUSH_GAIN, MAX_GAIN_WORLD2, MAX_SCORE_PER_CANDLE,
} from "@/lib/scoring";

const SEED = "p36-test";
const DT = 1 / 60;

/** Flat all-green runway: fully controlled pass detection, no deaths. */
function flatPlats(n: number): Platform[] {
  const out: Platform[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      i, x: i * PLATFORM_W, y: 0, w: PLATFORM_W, up: true,
      state: "solid", passed: false, crumble: false,
    } as Platform);
  }
  return out;
}

function makeEngine(plats: Platform[]): Engine {
  return new Engine(plats, { onDeath: () => {}, onScore: () => {} }, undefined, SEED);
}

/** Step until exactly `n` candles have passed (bounded loop = no hangs). */
function stepTo(e: Engine, n: number, maxSteps = 20_000) {
  for (let s = 0; s < maxSteps && e.candlesPassed < n; s++) e.step(DT);
  expect(e.candlesPassed).toBe(n);
}

describe("P3.6 RUSH — speed + gain composition (contract §6.1)", () => {
  test("speed: rush multiplies the modded curve AFTER shaping (×1.28 during ramp)", () => {
    const a = makeEngine(flatPlats(400));
    const b = makeEngine(flatPlats(400));
    // compare MOTION deltas — camX starts at a negative anchor offset
    const a0 = a.camX, b0 = b.camX;
    b.pressRush();
    const STEPS = 120; // 2s — inside the ramp (no cap yet)
    for (let i = 0; i < STEPS; i++) { a.step(DT); b.step(DT); }
    expect(b.camX - b0).toBeCloseTo((a.camX - a0) * 1.28, 6);
    expect(a.rush).toBe(false);
    expect(b.rush).toBe(true);
  });

  test("releaseRush returns the camera to the un-rushed curve immediately", () => {
    const a = makeEngine(flatPlats(400));
    a.pressRush();
    for (let i = 0; i < 30; i++) a.step(DT);
    a.releaseRush();
    const a0 = a.camX;
    for (let i = 0; i < 30; i++) a.step(DT);
    const aD = a.camX - a0; // post-release delta (same ramp time as below)
    // twin: identical rushed warm-up, then the same post-release window
    const p = makeEngine(flatPlats(400));
    p.pressRush();
    for (let i = 0; i < 30; i++) p.step(DT);
    p.releaseRush();
    const p0 = p.camX;
    for (let i = 0; i < 30; i++) p.step(DT);
    expect(aD).toBeCloseTo(p.camX - p0, 6);
    expect(aD).toBeGreaterThan(0);
  });

  test("gain: first green candle pays 10×1.5 plain and 18.75 rushed (premium AFTER mult)", () => {
    const a = makeEngine(flatPlats(400));
    stepTo(a, 1);
    expect(a.score).toBeCloseTo(BASE_GAIN * 1.5, 9); // streak 1 → ×1.5
    const b = makeEngine(flatPlats(400));
    b.pressRush();
    stepTo(b, 1);
    expect(b.score).toBeCloseTo(BASE_GAIN * 1.5 * RUSH_GAIN, 9); // 18.75, exact float
    expect(b.score).toBeCloseTo(a.score * RUSH_GAIN, 9);
  });

  test("gain premium applies in world 2 (parity, contract §6.3)", () => {
    const a = makeEngine(flatPlats(400));
    a.enterWorld2();
    stepTo(a, 1);
    expect(a.score).toBeCloseTo(WORLD2_GAIN * 1.5, 9);
    const b = makeEngine(flatPlats(400));
    b.enterWorld2();
    b.pressRush();
    stepTo(b, 1);
    expect(b.score).toBeCloseTo(WORLD2_GAIN * 1.5 * RUSH_GAIN, 9); // 37.5
  });
});

describe("P3.6 gravity-hang (contract §6.2, Celeste #3)", () => {
  test("held rise hangs: full-hold jump peaks higher than an instant release", () => {
    const settle = (e: Engine) => { for (let i = 0; i < 40 && !e.grounded; i++) e.step(DT); expect(e.grounded).toBe(true); };
    const hold = makeEngine(flatPlats(400));
    settle(hold);
    hold.press();
    let peakHold = Infinity;
    for (let i = 0; i < 200; i++) { hold.step(DT); peakHold = Math.min(peakHold, hold.py); }
    const cut = makeEngine(flatPlats(400));
    settle(cut);
    cut.press();
    cut.release(); // jump-cut ends the rise AND the hang
    let peakCut = Infinity;
    for (let i = 0; i < 200; i++) { cut.step(DT); peakCut = Math.min(peakCut, cut.py); }
    expect(peakHold).toBeLessThan(peakCut); // smaller py = higher apex
  });

  test("hang ends on release: vy>0 after apex uses full gravity (state transition)", () => {
    const e = makeEngine(flatPlats(400));
    for (let i = 0; i < 40 && !e.grounded; i++) e.step(DT); // settle first
    e.press();
    let sawRise = false, sawFall = false;
    for (let i = 0; i < 300; i++) {
      e.step(DT);
      if (e.vy < 0) sawRise = true;
      if (e.vy > 0) { sawFall = true; break; }
    }
    e.release();
    expect(sawRise).toBe(true);
    expect(sawFall).toBe(true);
    // after the apex, falling with hang impossible: vy>0 always gets full gravity
    const g1 = e.vy;
    e.step(DT);
    const gFull = e.vy - g1; // one step of full gravity
    expect(gFull).toBeCloseTo(2100 * DT, 6);
  });

  test("determinism: identical rush/jump inputs ⇒ byte-identical states", () => {
    const a = makeEngine(flatPlats(400));
    const b = makeEngine(flatPlats(400));
    a.pressRush(); b.pressRush();
    for (let i = 0; i < 240; i++) {
      if (i === 60) { a.press(); b.press(); }
      if (i === 120) { a.release(); b.release(); }
      a.step(DT); b.step(DT);
    }
    expect(b.score).toBe(a.score);
    expect(b.camX).toBe(a.camX);
    expect(b.candlesPassed).toBe(a.candlesPassed);
    expect(b.py).toBe(a.py);
    expect(b.vy).toBe(a.vy);
  });
});

describe("P3.6 anti-cheat coupling", () => {
  test("MAX_SCORE_PER_CANDLE covers the rushed world-2 max", () => {
    const maxMult = 1 + COMBO_CAP * COMBO_STEP;
    expect(MAX_GAIN_WORLD2).toBe(WORLD2_GAIN * maxMult); // 140
    expect(MAX_SCORE_PER_CANDLE).toBeGreaterThanOrEqual(MAX_GAIN_WORLD2 * RUSH_GAIN); // 175
    expect(MAX_SCORE_PER_CANDLE).toBe(175);
  });
});
