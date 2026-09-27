// Candle Climber engine — fixed-timestep physics, auto-scroll runner over candle platforms
import type { Platform, Particle, RunResult, DeathCause } from "./types";
import { PLATFORM_W } from "./level";

export const VIEW_W = 800; // logical units (canvas is scaled to fit)
export const VIEW_H = 480;

const GRAVITY = 2100;
const JUMP_V = 760;
const JUMP_CUT = 0.72;
const COYOTE = 0.09;
const BUFFER = 0.12;
const CRUMBLE_TIME = 0.26;
const PLAYER_X_FRAC = 0.3; // screen anchor
const PLAYER_W = 34;
const PLAYER_H = 40;
const CAM_BASE = 175; // px/s
const CAM_ACCEL = 5.5; // px/s per second
const CAM_MAX = 470;

export interface EngineCallbacks {
  onDeath: (r: RunResult) => void;
  onScore: (score: number, combo: number) => void;
}

export class Engine {
  plats: Platform[];
  particles: Particle[] = [];
  // player (px is camera-locked: world x derived from camX)
  py = 0; vy = 0;
  grounded = false; groundPlat: Platform | null = null;
  coyote = 0; buffer = 0; jumpHeld = false; jumpCut = false;
  // camera / world
  camX = 0; camY = 0; speed = CAM_BASE;
  time = 0;
  // run stats
  score = 0; candlesPassed = 0; streak = 0; bestStreak = 0;
  lastLandUp: boolean | null = null;
  dead = false; deathCause: DeathCause = 'fell'; deathT = 0;
  shake = 0;
  private cb: EngineCallbacks;

  // player world x is always locked to the screen anchor (30% of view)
  get px(): number {
    return this.camX + VIEW_W * PLAYER_X_FRAC - PLAYER_W / 2;
  }

  constructor(plats: Platform[], cb: EngineCallbacks) {
    this.plats = plats;
    this.cb = cb;
    // start ON the first platform: camera aligned so the player anchor
    // sits right on the platform center (safe runway)
    const start = plats.find((p) => p.state === "solid") ?? plats[0];
    this.py = start.y - 140;
    this.camY = this.py - VIEW_H * 0.55;
    this.camX = start.x + PLATFORM_W / 2 - VIEW_W * PLAYER_X_FRAC;
  }

  get playerScreenX() { return this.px - this.camX; }

  press() { this.buffer = BUFFER; this.jumpHeld = true; this.jumpCut = false; }
  release() {
    this.jumpHeld = false;
    if (this.vy < 0 && !this.jumpCut) { this.vy *= JUMP_CUT; this.jumpCut = true; }
  }

  private spawnParticles(n: number, x: number, y: number, color: string, spread = 180) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * spread,
        vy: -Math.random() * spread * 0.8,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.9,
        size: 2 + Math.random() * 4,
        color,
      });
    }
  }

  private die(cause: DeathCause) {
    if (this.dead) return;
    this.dead = true;
    this.deathCause = cause;
    this.deathT = 0;
    this.shake = 14;
    this.spawnParticles(26, this.px + PLAYER_W / 2, this.py + PLAYER_H / 2, "#CCFF00", 320);
    this.cb.onDeath({
      score: Math.floor(this.score),
      candlesPassed: this.candlesPassed,
      bestStreak: this.bestStreak,
      cause,
      candleIndex: this.candlesPassed,
    });
  }

  private solidUnder(px: number, plat: Platform): boolean {
    return (
      plat.state === "solid" &&
      px + PLAYER_W > plat.x + 6 &&
      px < plat.x + plat.w - 2
    );
  }

  step(dt: number) {
    if (this.dead) {
      this.deathT += dt;
      this.stepParticles(dt);
      this.shake = Math.max(0, this.shake - dt * 40);
      return;
    }
    this.time += dt;
    this.speed = Math.min(CAM_MAX, CAM_BASE + this.time * CAM_ACCEL);
    this.camX += this.speed * dt;

    // jump input
    this.buffer = Math.max(0, this.buffer - dt);
    this.coyote = Math.max(0, this.coyote - dt);

    // gravity
    this.vy += GRAVITY * dt;
    this.py += this.vy * dt;

    // platform pass detection (world x under player anchor)
    const focus = this.camX + VIEW_W * PLAYER_X_FRAC;
    for (const p of this.plats) {
      if (!p.passed && p.x + p.w < focus) {
        p.passed = true;
        if (p.w > 0) {
          this.candlesPassed = p.i + 1;
          if (p.up) { this.streak++; this.bestStreak = Math.max(this.bestStreak, this.streak); }
          else this.streak = 0;
          const gain = 10 * (1 + Math.min(this.streak, 12) * 0.5);
          this.score += gain;
          this.cb.onScore(Math.floor(this.score), this.streak);
        }
      }
    }

    // landing check (falling only)
    if (this.vy >= 0) {
      const feet = this.py + PLAYER_H;
      for (const p of this.plats) {
        if (!this.solidUnder(this.px, p)) continue;
        if (feet >= p.y && feet - this.vy * dt <= p.y + 14) {
          this.py = p.y - PLAYER_H;
          this.vy = 0;
          if (!this.grounded) this.spawnParticles(5, this.px + PLAYER_W / 2, p.y, p.up ? "#5BD08A" : "#E07856", 90);
          this.lastLandUp = p.up;
          this.grounded = true;
          this.coyote = COYOTE;
          this.groundPlat = p;
          if (p.crumble && p.state === "solid") { p.state = "crumbling"; p.crumbleT = 0; }
          break;
        }
      }
    }
    if (this.grounded) {
      const p = this.groundPlat;
      const stillOn = p && this.solidUnder(this.px, p) && Math.abs(this.py + PLAYER_H - p.y) < 4 && this.vy === 0;
      if (!stillOn) { this.grounded = false; this.groundPlat = null; }
    }

    // crumble update
    for (const p of this.plats) {
      if (p.state === "crumbling") {
        p.crumbleT += dt;
        if (p.crumbleT >= CRUMBLE_TIME) {
          p.state = "gone";
          this.spawnParticles(10, p.x + p.w / 2, p.y, "#E07856", 140);
          if (this.groundPlat === p) { this.grounded = false; this.groundPlat = null; this.coyote = 0; }
        }
      }
    }

    // buffered jump execution
    if (this.buffer > 0 && (this.grounded || this.coyote > 0)) {
      this.vy = -JUMP_V;
      this.grounded = false; this.groundPlat = null; this.coyote = 0; this.buffer = 0; this.jumpCut = false;
    }

    // death: fell below view
    if (this.py > this.camY + VIEW_H + 80) {
      this.die(this.lastLandUp === false ? "crumbled" : "fell");
    }

    this.camY += (this.py - VIEW_H * 0.52 - this.camY) * Math.min(1, dt * 4.2);
    if (this.camY > 0) this.camY = 0;
    this.shake = Math.max(0, this.shake - dt * 30);
    this.stepParticles(dt);
  }

  private stepParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const q = this.particles[i];
      q.life -= dt;
      if (q.life <= 0) { this.particles.splice(i, 1); continue; }
      q.vy += GRAVITY * 0.4 * dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
    }
  }
}
