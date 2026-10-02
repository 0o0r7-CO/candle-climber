// P7.1 rival bot — headless driver (local, zero-infra, zero network).
//
// Owns a SECOND Engine instance running in the SAME world: the bot's level is
// built by the SAME buildPlatforms(candles, seed) call the human's engine uses
// (byte-deterministic per (candles, seed) — reused, never forked), and it is
// stepped on the SAME fixed-timestep clock by GameCanvas's single RAF loop
// (bot.tick(dt) inside the accumulator, never a second RAF).
//
// ANTI-CHEAT RED LINE (W5 untouched): the bot NEVER posts scores anywhere (the
// human-side leaderboard route stays bot-blind) and never touches run-tokens.
// Its score/height exist for local UI only — the human's submission flow is
// byte-identical whether or not the bot runs.
//
// DEATH POLICY (documented choice per P7.1 spec): when the bot dies it
// respawns COLD exactly once per human run — a fresh run from candle 0 on the
// same deterministic terrain — for drama. After the second death it simply
// stops (its numbers freeze; the verdict compares frozen values).
import { Engine, CAM_BASE, CAM_ACCEL, CAM_MAX, RUSH_SPEED } from "../engine";
import { buildPlatforms } from "../level";
import { CHARACTERS } from "../characters";
import { hashString } from "../rng";
import type { Candle } from "../types";
import type { MutationMods } from "../mutations";
import { personalityForCharId, type BotPersonality } from "./personality";
import {
  evalPressNow, shouldPress, wantRush, slopTicks, FIXED_DT, PANIC_TICKS,
  type BotSnapshot,
} from "./planner";

/** Deterministic rival skin per level: same seed ⇒ same rival for everyone. */
export function pickRivalCharId(seedStr: string): string {
  const roster = CHARACTERS.filter((c) => c.sheet); // 14 skinned characters
  return roster[hashString(seedStr + ":rival-char") % roster.length].id;
}

export interface RivalVerdict { line: string; won: boolean; tie: boolean }

/** Local verdict line (P7.1) — pure, client-side only, never sent anywhere. */
export function rivalVerdict(humanCandles: number, rivalCandles: number): RivalVerdict {
  if (humanCandles > rivalCandles) {
    return { line: `YOU WON — RIVAL ${rivalCandles} / YOU ${humanCandles}`, won: true, tie: false };
  }
  if (humanCandles < rivalCandles) {
    return { line: `RIVAL WINS — RIVAL ${rivalCandles} / YOU ${humanCandles}`, won: false, tie: false };
  }
  return { line: `DEAD HEAT — RIVAL ${rivalCandles} / YOU ${humanCandles}`, won: false, tie: true };
}

export class RivalBot {
  readonly charId: string;
  readonly personality: BotPersonality;
  eng: Engine;
  /** Cold restarts used (cap 1 → max 2 attempts per human run). */
  attempts = 1;
  /** True after the second death — the rival is gone, numbers frozen. */
  stopped = false;
  /** Current-attempt candles (live HUD chip). */
  candles = 0;
  /** Best attempt — the verdict number (a cold respawn resets progress, not pride). */
  bestCandles = 0;
  bestScore = 0;

  private readonly candlesData: Candle[];
  private readonly seedStr: string;
  private readonly mods: MutationMods;
  // per-attempt driver state
  private wasGrounded = false;
  private sinceLand = 0;
  private airPressed = false;
  private cutPending = false;
  private pendingSlop = 0;
  private landSeq = 0;

  constructor(candles: Candle[], seedStr: string, charId: string, mods: MutationMods) {
    this.candlesData = candles;
    this.seedStr = seedStr;
    this.mods = mods;
    this.charId = charId;
    this.personality = personalityForCharId(charId);
    this.eng = this.buildEngine();
  }

  /** The SAME deterministic level build the human plays — no generation fork. */
  private buildEngine(): Engine {
    const plats = buildPlatforms(this.candlesData, this.seedStr);
    return new Engine(
      plats,
      // silent head: the rival never plays sounds and never reports scores
      { onDeath: () => {}, onScore: () => {} },
      this.mods,
      this.seedStr, // world-2 sky seed — same string, same endless sky
    );
  }

  private respawn() {
    this.attempts++;
    this.eng = this.buildEngine();
    this.wasGrounded = false;
    this.sinceLand = 0;
    this.airPressed = false;
    this.cutPending = false;
    this.pendingSlop = 0;
    this.landSeq = 0;
    this.candles = 0;
  }

  /** Ticks until the bot leaves the ground: take-off edge or crumble deadline. */
  private groundTicksLeft(): number {
    const e = this.eng;
    const p = e.groundPlat;
    if (!p) return 99;
    const speed =
      Math.min(CAM_MAX * e.mods.camSpeed, CAM_BASE * e.mods.camSpeed + e.time * CAM_ACCEL) *
      (e.rush ? RUSH_SPEED : 1);
    let ticks = Math.ceil(((p.x + p.w - 2) - e.px) / (speed * FIXED_DT));
    if (p.state === "crumbling") {
      ticks = Math.min(ticks, Math.ceil((e.mods.crumbleTime - p.crumbleT) / FIXED_DT));
    }
    return Math.max(0, ticks);
  }

  private snap(): BotSnapshot {
    const e = this.eng;
    return {
      px: e.px,
      py: e.py,
      vy: e.vy,
      grounded: e.grounded,
      groundIdx: e.groundPlat ? e.plats.indexOf(e.groundPlat) : -1,
      time: e.time,
      rush: e.rush,
      sinceLand: this.sinceLand,
    };
  }

  private onLanded() {
    this.landSeq++;
    this.airPressed = false;
    this.cutPending = false;
    this.sinceLand = 0;
    this.pendingSlop = slopTicks(this.seedStr, this.landSeq, this.personality);
    const rush = wantRush(this.personality);
    if (rush && !this.eng.rush) this.eng.pressRush();
    else if (!rush && this.eng.rush) this.eng.releaseRush();
  }

  /** One fixed tick: plan → synthesize inputs → step the headless engine. */
  tick(dt: number) {
    if (this.stopped) return;
    const e = this.eng;
    if (e.dead) {
      if (this.attempts < 2) this.respawn();
      else this.stopped = true;
      return;
    }

    if (e.grounded && !this.wasGrounded) this.onLanded(); // resets sinceLand to 0
    this.wasGrounded = e.grounded;
    this.sinceLand += dt; // time since the landing moment (patience gate)

    let act: { press: boolean; hold: boolean } | null = null;
    if (e.grounded) {
      const ev = evalPressNow(this.snap(), e.plats, e.mods, e.rush);
      const ticksLeft = this.groundTicksLeft();
      const d = shouldPress(this.snap(), ev, this.personality, ticksLeft);
      if (d.press) {
        // sloppiness: the press fires a few deterministic ticks off the ideal
        // moment and is COMMITTED even if the re-check turns negative — that
        // commitment is the bot's humanity (panic overrides the delay).
        if (this.pendingSlop > 0 && ticksLeft > PANIC_TICKS) this.pendingSlop--;
        else act = d;
      }
    } else if (!this.airPressed && e.coyote > 0) {
      // walked off the ledge — last-chance feasibility check inside coyote
      const ev = evalPressNow(this.snap(), e.plats, e.mods, e.rush);
      if (ev.full.ok || ev.cut.ok) act = { press: true, hold: ev.full.ok };
      else if (e.coyote <= dt + 1e-9) act = { press: true, hold: true }; // go out jumping
    }

    if (act) {
      this.airPressed = true;
      e.press();
      if (!act.hold) this.cutPending = true;
    } else if (this.cutPending) {
      e.release(); // jump-cut: end the rise one tick after the press
      this.cutPending = false;
    }

    e.step(dt);

    this.candles = e.candlesPassed;
    this.bestCandles = Math.max(this.bestCandles, e.candlesPassed);
    this.bestScore = Math.max(this.bestScore, Math.floor(e.score));
    // the rival doesn't wait on panels: past the summit it auto-continues
    if (e.graduated && !e.world2) e.enterWorld2();
  }
}
