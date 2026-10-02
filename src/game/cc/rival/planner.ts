// P7.1 rival bot — heuristic jump planner (PURE, deterministic, zero I/O).
//
// The Candle Climber engine is a locked-x auto-climber: the player's world x is
// a pure function of engine.time (camera speed curve), and a jump is a fixed
// ballistic arc (full-hold or jump-cut). That makes "can I reach the next
// platform from here?" EXACTLY computable: this planner forward-simulates the
// engine's own math (same constants, same step order, same fixed 1/60 timestep)
// for the two possible press variants and reports the predicted landing.
//
// No ML, no network, no randomness: every function here is a pure function of
// its arguments (hashString is deterministic). The planner runs once per fixed
// tick while the bot is grounded and answers one question — "press jump NOW?"
import type { Platform } from "../types";
import type { MutationMods } from "../mutations";
import type { BotPersonality } from "./personality";
import {
  GRAVITY, JUMP_V, JUMP_CUT, HANG_GRAVITY, RUSH_SPEED,
  CAM_BASE, CAM_ACCEL, CAM_MAX, PLAYER_W, PLAYER_H, VIEW_H,
} from "../engine";
import { hashString } from "../rng";

/** The fixed timestep every engine (human + rival) steps on. */
export const FIXED_DT = 1 / 60;
/** Ticks before the take-off edge (or a crumble deadline) where thresholds are
 *  abandoned and the bot presses whatever it has — survival over style. */
export const PANIC_TICKS = 5;
/** Hard cap for one forward rollout (~1.6s — any real jump lands inside it). */
const MAX_SIM_STEPS = 96;
/** How many platforms ahead of the current one the sim scans for landings. */
const SCAN_AHEAD = 14;

export interface BotSnapshot {
  px: number; // world x of the player's left edge (engine.px)
  py: number;
  vy: number;
  grounded: boolean;
  /** plats index underfoot (-1 while airborne). Landing targets must be ahead. */
  groundIdx: number;
  time: number; // engine.time (drives the speed curve)
  rush: boolean;
  /** Seconds since the last landing (patience gate). */
  sinceLand: number;
}

export interface PressEval {
  /** Pressing now lands on a solid platform strictly ahead of the current one. */
  ok: boolean;
  /** Landing platform index (-1 when the rollout finds nothing). */
  landIdx: number;
  /** 0..1 — how centered the predicted landing is on the target. */
  alignment: number;
  /** px from the predicted landing center to the nearest target edge. */
  margin: number;
  /** Sim ticks until the predicted landing. */
  ticksToLand: number;
  /** Target is a red candle — it starts crumbling the moment we touch it. */
  risky: boolean;
}

const FAIL: PressEval = { ok: false, landIdx: -1, alignment: 0, margin: 0, ticksToLand: MAX_SIM_STEPS, risky: false };

/** Mirror of the engine's camera speed curve (engine.step lines). */
function speedAt(time: number, mods: MutationMods, rush: boolean): number {
  const cap = CAM_MAX * mods.camSpeed;
  const base = CAM_BASE * mods.camSpeed;
  return Math.min(cap, base + time * CAM_ACCEL) * (rush ? RUSH_SPEED : 1);
}

/**
 * Forward-simulate ONE press variant from the snapshot. Mirrors engine.step's
 * jump path exactly: buffered jump executes at the END of the first step; a
 * "cut" applies release (vy ×= JUMP_CUT, hang ends) before the second step.
 */
function simulatePress(s: BotSnapshot, plats: Platform[], mods: MutationMods, rush: boolean, hold: boolean): PressEval {
  const jumpHeldStart = s.grounded || s.vy === 0; // press requires ground or coyote — caller guarantees
  if (!jumpHeldStart) return FAIL;

  let px = s.px, py = s.py, vy = s.vy, t = s.time;
  let pressed = false, cutDone = !hold ? false : true; // cut variant releases after step 1
  const i0 = Math.max(0, s.groundIdx);
  const iMax = Math.min(plats.length - 1, i0 + SCAN_AHEAD);

  for (let k = 1; k <= MAX_SIM_STEPS; k++) {
    // cut fires between step 1 and 2 (driver calls release() right after press)
    if (!hold && !cutDone && k >= 2) { vy *= JUMP_CUT; cutDone = true; }
    t += FIXED_DT;
    px += speedAt(t, mods, rush) * FIXED_DT;
    const hangK = (hold || !cutDone) && vy < 0 ? HANG_GRAVITY : 1;
    vy += GRAVITY * mods.gravity * hangK * FIXED_DT;
    py += vy * FIXED_DT;

    // buffered jump executes at the end of the first step (engine order)
    if (!pressed) { vy = -JUMP_V * mods.jump; pressed = true; continue; }

    // landing check (falling only) — exact mirror of the engine's scan
    if (vy >= 0) {
      const feet = py + PLAYER_H;
      for (let i = i0; i <= iMax; i++) {
        const p = plats[i];
        if (!p || p.state !== "solid") continue;
        if (!(px + PLAYER_W > p.x + 6 && px < p.x + p.w - 2)) continue;
        if (feet >= p.y && feet - vy * FIXED_DT <= p.y + 14) {
          if (i <= s.groundIdx) return FAIL; // landed back where we started — wasted jump
          const cx = px + PLAYER_W / 2;
          const margin = Math.min(cx - p.x, p.x + p.w - cx);
          const rel = p.w > 0 ? (cx - p.x) / p.w : 0.5;
          return {
            ok: true,
            landIdx: i,
            alignment: Math.max(0, 1 - Math.abs(rel - 0.5) * 2),
            margin,
            ticksToLand: k,
            risky: p.crumble,
          };
        }
      }
    }
    // fell out of the world during the rollout (camY approximation: any real
    // jump lands within MAX_SIM_STEPS, so "no landing by the cap" ≈ death)
    if (py > s.py + VIEW_H + 120) return FAIL;
  }
  return FAIL;
}

export interface PressEvals { full: PressEval; cut: PressEval }

/** Evaluate both press variants for "jump NOW?" — pure, ~190 sim steps max. */
export function evalPressNow(s: BotSnapshot, plats: Platform[], mods: MutationMods, rush: boolean): PressEvals {
  return {
    full: simulatePress(s, plats, mods, rush, true),
    cut: simulatePress(s, plats, mods, rush, false),
  };
}

/**
 * The per-tick decision. Personality gates:
 *  - patience:  no press until `patienceS` after landing (panic overrides)
 *  - precision: predicted landing must be centered enough
 *  - risk:      predicted landing must clear a margin floor (high risk = low floor)
 *  - panic:     near the take-off edge / crumble deadline, press the best
 *               available rollout (even a doomed one — drama, never freeze)
 * The returned `hold` selects full-hold vs jump-cut.
 */
export function shouldPress(
  s: BotSnapshot,
  ev: PressEvals,
  p: BotPersonality,
  /** Ticks until the bot leaves the ground (edge or crumble deadline). */
  ticksLeft: number,
): { press: boolean; hold: boolean } {
  const panic = s.grounded && ticksLeft <= PANIC_TICKS;
  if (panic) {
    if (ev.full.ok) return { press: true, hold: true };
    if (ev.cut.ok) return { press: true, hold: false };
    return { press: true, hold: true }; // best effort — go out jumping
  }
  if (s.sinceLand < p.patienceS) return { press: false, hold: true };

  const marginReq = 4 + (1 - p.risk) * 20;        // risk 1 → 4px, risk 0 → 24px
  const alignReq = 0.05 + p.precision * 0.67;     // precision 1 → 0.72
  const meets = (c: PressEval) => c.ok && c.margin >= marginReq && c.alignment >= alignReq;
  const fullOk = meets(ev.full);
  const cutOk = meets(ev.cut);
  if (fullOk && cutOk) {
    // both work — take the better-centered landing; tie (rare, float-exact) → full
    return ev.cut.alignment > ev.full.alignment ? { press: true, hold: false } : { press: true, hold: true };
  }
  if (fullOk) return { press: true, hold: true };
  if (cutOk) return { press: true, hold: false };
  return { press: false, hold: true };
}

/** Rush policy (greed): hold RUSH from landing until the next landing. */
export function wantRush(p: BotPersonality): boolean {
  return p.greed >= 0.6;
}

/** Deterministic per-landing execution error in ticks: [-S, +S], S ≤ 3.
 *  The driver commits to the press even if the delayed re-check turns negative —
 *  that commitment IS the bot's humanity. Pure: hash of (seed, landing count). */
export function slopTicks(seedStr: string, landSeq: number, p: BotPersonality): number {
  const S = Math.round(p.sloppiness * 3);
  if (S <= 0) return 0;
  const h = hashString(`${seedStr}:rival-land:${landSeq}`);
  return (h % (2 * S + 1)) - S;
}
