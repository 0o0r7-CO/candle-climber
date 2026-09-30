/// <reference types="bun-types" />
// W4 graduation arc — invariant tests (bun test, zero new dependencies).
// White-box is intentional: these tests pin the engine↔route↔card coupling
// that the audits flagged as untested (audit_code.md lens 9).
//
// Covered (spec §5 / §6):
//  a) buildPlatforms marks exactly the LAST platform summit:true
//  b) landing on / passing the summit fires onGraduate, engine.graduated=true
//  c) world 2 doubles the per-candle gain (behavioral, same seed same steps)
//  d) world-2 chunked terrain generation is deterministic
//  e) leaderboard MAX_SCORE_PER_CANDLE covers both engine gain modes (70/140)
//  f) graduated death-card variant lines (pure helper; canvas-free)
import { describe, test, expect } from "bun:test";
import { buildPlatforms, CANDLE_W } from "@/game/cc/level";
import { syntheticCandles, LIMIT } from "@/game/cc/level-source";
import { Engine, VIEW_W } from "@/game/cc/engine";
import {
  MAX_SCORE_PER_CANDLE,
  MAX_GAIN_NORMAL,
  MAX_GAIN_WORLD2,
  BASE_GAIN,
  WORLD2_GAIN,
  COMBO_CAP,
  COMBO_STEP,
} from "@/lib/scoring";
import { milestoneLines } from "@/game/cc/deathcard";
import type { SfxName } from "@/game/cc/engine";

// the app's seed string is `${date}${symbol}` (see GameCanvas buildEngine)
const DATE = "2026-09-30";
const SEEDS = [`${DATE}SOLUSDT`, `${DATE}BTCUSDT`];

function fixture(seedStr: string) {
  const candles = syntheticCandles(DATE, LIMIT); // real CandleData-shaped input
  return { candles, plats: buildPlatforms(candles, seedStr) };
}

function makeEngine(seedStr: string, opts: { graduated?: () => void; sfx?: SfxName[] } = {}) {
  const { plats } = fixture(seedStr);
  const e = new Engine(
    plats,
    { onDeath: () => {}, onScore: () => {}, onSfx: (s) => opts.sfx?.push(s), onGraduate: () => opts.graduated?.() },
    undefined,
    seedStr,
  );
  return e;
}

describe("W4 summit + graduation arc", () => {
  test("a) buildPlatforms marks exactly the last platform as summit", () => {
    for (const seedStr of SEEDS) {
      const { plats } = fixture(seedStr);
      expect(plats.length).toBe(LIMIT);
      const summitIdx = plats.map((p, i) => (p.summit ? i : -1)).filter((i) => i >= 0);
      expect(summitIdx).toEqual([plats.length - 1]);
    }
  });

  test("b) passing the summit fires onGraduate + victory sfx, run does not end", () => {
    const seedStr = SEEDS[0];
    const { plats } = fixture(seedStr);
    const summit = plats[plats.length - 1];
    let fired = 0;
    const sfx: SfxName[] = [];
    const e = new Engine(
      plats,
      { onDeath: () => {}, onScore: () => {}, onSfx: (s) => sfx.push(s), onGraduate: () => { fired++; } },
      undefined,
      seedStr,
    );
    // park the camera just past the summit's right edge -> pass detection fires
    e.camX = summit.x + summit.w + 10 - VIEW_W * 0.3;
    e.py = summit.y - 40; // standing height, no fall
    e.vy = 0;
    e.step(1 / 60);
    expect(e.graduated).toBe(true);
    expect(e.dead).toBe(false); // graduation is a milestone, not a death
    expect(fired).toBe(1);
    expect(sfx).toContain("victory");
    // idempotent: a second trigger must not re-fire
    e.step(1 / 60);
    expect(fired).toBe(1);
  });

  test("b2) landing on the summit graduates", () => {
    // deterministic candidate pick: first fixture whose last platform is solid
    const seedStr = SEEDS.find((s) => {
      const { plats } = fixture(s);
      const last = plats[plats.length - 1];
      return last.state === "solid" && last.w > 0;
    });
    if (!seedStr) throw new Error("no candidate seed with a solid summit platform");
    const { plats } = fixture(seedStr);
    const summit = plats[plats.length - 1];
    let fired = 0;
    const e = makeEngine(seedStr, { graduated: () => { fired++; } });
    // center the player over the summit, a few px above the surface
    e.camX = summit.x + summit.w / 2 - VIEW_W * 0.3;
    e.py = summit.y - 40 - 6;
    e.vy = 0;
    for (let i = 0; i < 30 && !e.graduated; i++) e.step(1 / 60);
    expect(e.graduated).toBe(true);
    expect(fired).toBe(1);
  });

  test("c) world 2 doubles the per-candle gain (behavioral, same steps)", () => {
    const scoreAfterPassing = (seedStr: string, k: number, world2: boolean): number => {
      const { plats } = fixture(seedStr);
      const e = makeEngine(seedStr);
      if (world2) e.enterWorld2();
      const edge = plats[k - 1].x + plats[k - 1].w + 1;
      e.camX = edge - VIEW_W * 0.3;
      e.py = plats[0].y - 40;
      e.vy = 0;
      e.step(1 / 60);
      return Math.floor(e.score);
    };
    const normal = scoreAfterPassing(SEEDS[0], 8, false);
    const doubled = scoreAfterPassing(SEEDS[0], 8, true);
    expect(normal).toBeGreaterThan(0);
    expect(doubled).toBe(normal * 2);
    // constant-level relationship (engine reads these exact constants)
    expect(MAX_GAIN_NORMAL).toBe(BASE_GAIN * (1 + COMBO_CAP * COMBO_STEP));
    expect(MAX_GAIN_WORLD2).toBe(WORLD2_GAIN * (1 + COMBO_CAP * COMBO_STEP));
    expect(MAX_GAIN_WORLD2).toBe(2 * MAX_GAIN_NORMAL);
    expect(MAX_GAIN_NORMAL).toBe(70);
    expect(MAX_GAIN_WORLD2).toBe(140);
  });

  test("d) world-2 terrain generation is deterministic (same seed, same steps)", () => {
    const run = () => {
      const { plats } = fixture(SEEDS[0]);
      const e = new Engine(
        plats,
        { onDeath: () => {}, onScore: () => {} },
        undefined,
        SEEDS[0],
      );
      e.enterWorld2();
      // jump the camera to the terrain edge so chunks MUST generate in-step
      e.camX = (plats.length - 1) * CANDLE_W - VIEW_W - 60;
      // keep the runner airborne-but-alive: high above the abyss, zero velocity
      e.py = 0;
      e.vy = 0;
      for (let i = 0; i < 900; i++) {
        e.py = 0;
        e.vy = 0;
        e.step(1 / 60);
      }
      return e.plats.map((p) => [p.x, p.y, p.w, p.up] as const);
    };
    const a = run();
    const b = run();
    expect(a.length).toBeGreaterThan(LIMIT); // world 2 actually extended the level
    expect(b).toEqual(a); // identical terrain, byte for byte
  });

  test("e) leaderboard cap covers both engine gain modes", () => {
    expect(MAX_SCORE_PER_CANDLE).toBeGreaterThanOrEqual(MAX_GAIN_NORMAL); // 175 >= 70
    expect(MAX_SCORE_PER_CANDLE).toBeGreaterThanOrEqual(MAX_GAIN_WORLD2); // 175 >= 140
    // P3.6: the cap now also covers the RUSH premium (world2 full combo × 1.25)
    expect(MAX_SCORE_PER_CANDLE).toBe(175);
  });

  test("f) graduated death-card variant lines (pure helper, canvas-free)", () => {
    // plain death: no milestone copy, card unchanged
    expect(milestoneLines({ graduated: false, world2: false })).toEqual({
      ribbon: null,
      sub: null,
      world2Line: null,
    });
    // graduated (run still live snapshot): ribbon + summit flavor, no world-2 line
    const g = milestoneLines({ graduated: true, world2: false });
    expect(g.ribbon).toBe("GRADUATED");
    expect(g.sub).toContain("curve summit reached");
    expect(g.sub).toContain("5 eth class");
    expect(g.world2Line).toBeNull();
    // graduated + world 2 (died after entering the buyback world)
    const w2 = milestoneLines({ graduated: true, world2: true });
    expect(w2.ribbon).toBe("GRADUATED");
    expect(w2.world2Line).toContain("world 2 reached");
  });
});
