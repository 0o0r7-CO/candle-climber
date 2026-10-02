// P7.2 ghost runs — PURE core (recorder, validation, replay sampling).
//
// A ghost is a POSITION STREAM (not inputs — engine determinism across devices
// is not required per the P7.2 spec): the player's (x, y) sampled at a fixed
// GHOST_HZ cadence during one run. Replaying is a plain index lookup by the
// replaying engine's own clock — same terrain (byte-deterministic per
// (candles, seed)), same cadence, so the ghost walks the run it recorded.
//
// ANTI-CHEAT POSTURE (mirrors W1/W5 layering):
// - The recorder is client-side and honest, but ghosts are COSMETIC: a forged
//   ghost can never affect scores, ranks, or the human's submission flow.
// - The POST route still verifies the HMAC run-token and pins symbol/date/
//   interval EXCLUSIVELY from it (same as /api/leaderboard), and this pure
//   validator enforces physical caps + shape bounds so garbage cannot enter
//   the store (Mongo doc bloat is the real attack surface here).
// Zero network inside this module (pinned by test/ghost.test.ts).

/** Ghost sampling rate (Hz) — every 2nd fixed 1/60 tick. */
export const GHOST_HZ = 30;
/** Fixed timestep the recorder is ticked on (the engine's clock). */
export const GHOST_FIXED_DT = 1 / 60;
/** Hard cap: 3600 samples = 120 s of run at 30 Hz (~29 KB JSON as flat ints).
 *  World-2 marathon runs simply stop recording — the ghost freezes in place. */
export const MAX_GHOST_SAMPLES = 3600;
/** Store keeps the best N ghosts per (symbol|date|interval) terrain. */
export const GHOSTS_PER_TERRAIN = 5;
/** GET payload cap — replay only needs the champion (send top 3). */
export const GHOSTS_SERVED = 3;

/** Coordinate bounds (world px): camera max 400 px/s × 120 s ≈ 48k + slack. */
export const GHOST_X_MAX = 200_000;
export const GHOST_Y_MIN = -2_000;
export const GHOST_Y_MAX = 2_000;

/** Flat stream: [x0, y0, x1, y1, …] — world px, integers, fixed cadence. */
export type GhostSamples = number[];

/** Records the HUMAN engine's position stream during one run. */
export class GhostRecorder {
  private samples: GhostSamples = [];
  private tickCount = 0;
  private active = false;

  start() {
    this.samples = [];
    this.tickCount = 0;
    this.active = true;
  }

  stop() {
    this.active = false;
  }

  /** Call once per fixed tick while the run is live (running phase only). */
  tick(px: number, py: number) {
    if (!this.active) return;
    if (this.tickCount % 2 === 0 && this.samples.length < MAX_GHOST_SAMPLES * 2) {
      this.samples.push(Math.round(px), Math.round(py));
    }
    this.tickCount++;
  }

  get recording() {
    return this.active;
  }

  get count() {
    return this.samples.length / 2;
  }

  /** Flat stream snapshot — empty array when the recorder never started. */
  flush(): GhostSamples {
    return this.samples.slice();
  }
}

export interface GhostEntry {
  name: string;
  charId: string;
  candlesPassed: number;
  symbol: string;
  date: string;
  interval: string;
  ts: number;
  samples: GhostSamples;
}

export type GhostVerdict =
  | { ok: true; entry: GhostEntry }
  | { ok: false; error: string; status: number };

/**
 * Validate a ghost POST body against the already-verified token payload.
 * Pure — same layering as validateSubmission (W5): the route hands over the
 * VERIFIED token payload; client-claimed symbol/date/interval are ignored.
 */
export function validateGhost(
  body: Record<string, unknown>,
  tok: { symbol: string; date: string; interval: string },
  maxCandles: number,
  now: number = Date.now(),
): GhostVerdict {
  const raw = body.samples;
  if (!Array.isArray(raw)) return { ok: false, error: "invalid samples", status: 400 };
  if (raw.length === 0) return { ok: false, error: "empty samples", status: 400 };
  if (raw.length % 2 !== 0) return { ok: false, error: "invalid samples", status: 400 };
  if (raw.length > MAX_GHOST_SAMPLES * 2) {
    return { ok: false, error: "samples exceed cap", status: 400 };
  }
  const samples: GhostSamples = [];
  for (let i = 0; i < raw.length; i++) {
    const v = Number(raw[i]);
    if (!Number.isFinite(v)) return { ok: false, error: "invalid sample", status: 400 };
    const r = Math.round(v);
    if (r !== v) return { ok: false, error: "samples must be integers", status: 400 };
    if (i % 2 === 0) {
      if (r < 0 || r > GHOST_X_MAX) return { ok: false, error: "sample out of bounds", status: 400 };
    } else {
      if (r < GHOST_Y_MIN || r > GHOST_Y_MAX) return { ok: false, error: "sample out of bounds", status: 400 };
    }
    samples.push(r);
  }

  const candlesPassed = Math.floor(Number(body.candlesPassed ?? 0));
  if (!Number.isFinite(candlesPassed) || candlesPassed < 0 || candlesPassed > maxCandles) {
    return { ok: false, error: "invalid candles", status: 400 };
  }
  // physical sanity: a 120 s stream cannot claim a climb the stream length
  // cannot express (candles beyond the recorded horizon are impossible)
  if (candlesPassed > samples.length / 2) {
    return { ok: false, error: "candles exceed recorded horizon", status: 400 };
  }

  const charId = typeof body.charId === "string" && body.charId.length <= 24 && /^[a-z0-9-]+$/i.test(body.charId)
    ? body.charId
    : "default";

  return {
    ok: true,
    entry: {
      name: String(body.name ?? "ANON").replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, 14) || "ANON",
      charId,
      candlesPassed,
      symbol: tok.symbol,
      date: tok.date,
      interval: tok.interval,
      ts: now,
      samples,
    },
  };
}

export interface GhostView {
  x: number;
  y: number;
  charId: string;
  name: string;
  candles: number;
  frozen: boolean;
  /** Replay clock the view was sampled at (engine.time seconds). */
  t: number;
}

/**
 * Replay lookup — the ghost's position at the replaying engine's own clock.
 * `time` is engine.time (seconds since run start); the stream starts at t=0.
 * Past the end of the stream the ghost freezes at its last recorded position
 * (same "numbers freeze" policy as the P7.1 rival).
 */
export function ghostViewAt(entry: GhostEntry, time: number): GhostView | null {
  const n = entry.samples.length / 2;
  if (n === 0) return null;
  const rawIdx = Math.floor(time * GHOST_HZ);
  const idx = Math.min(Math.max(0, rawIdx), n - 1);
  return {
    x: entry.samples[idx * 2],
    y: entry.samples[idx * 2 + 1],
    charId: entry.charId,
    name: entry.name,
    candles: entry.candlesPassed,
    frozen: rawIdx > n - 1,
    t: time,
  };
}

/** Pick the champion ghost (highest climb) for replay — pure. */
export function bestGhost(entries: GhostEntry[]): GhostEntry | null {
  if (entries.length === 0) return null;
  return entries.reduce((a, b) => (b.candlesPassed > a.candlesPassed ? b : a));
}
