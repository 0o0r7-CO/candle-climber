// Level builder: candles -> playable platforms (rolling-normalized heights)
import type { Candle, Platform } from "./types";
import { hashString, mulberry32 } from "./rng";

export const CANDLE_W = 96;
export const PLATFORM_W = 72; // was 62 — G2: wider caps, less dead space between candles
export const AMP_MIN = 150; // px between rolling low/high closes
export const AMP_MAX = 330;

const LAUNCH_PAD = 4; // first N candles: flat, contiguous, safe runway
export const MAX_UP = 112;   // jump reach ≈ 158px (JUMP_V 815) — keep every step reachable
export const MAX_DOWN = 170;

export function buildPlatforms(candles: Candle[], seedStr: string): Platform[] {
  const gapRnd = mulberry32(hashString("cc-gaps:" + seedStr));
  const plats: Platform[] = [];
  const closeYs: number[] = [];
  const W = 40; // rolling normalization window

  for (let i = 0; i < candles.length; i++) {
    const lo0 = Math.max(0, i - W + 1);
    let min = Infinity, max = -Infinity;
    for (let j = lo0; j <= i; j++) {
      const c = candles[j].c;
      if (c < min) min = c;
      if (c > max) max = c;
    }
    const span = max - min || 1;
    const norm = (v: number) => AMP_MAX - ((v - min) / span) * (AMP_MAX - AMP_MIN);

    const up = candles[i].c >= candles[i].o;
    const tiny = span < Math.abs(max) * 0.0012; // near-flat window -> keep solid
    const launch = i < LAUNCH_PAD;

    // vertical placement with fairness clamp
    const prevClose = i > 0 ? closeYs[i - 1] : norm(candles[i].c);
    let cY: number, oY: number;
    if (launch) {
      cY = prevClose;         // flat pad
      oY = cY;
    } else {
      cY = Math.max(prevClose - MAX_DOWN, Math.min(prevClose + MAX_UP, norm(candles[i].c)));
      oY = Math.max(cY - MAX_DOWN, Math.min(cY + MAX_UP, norm(candles[i].o)));
    }
    closeYs.push(cY);

    const hiY = Math.min(cY, norm(candles[i].h));
    const loY = Math.max(cY, norm(candles[i].l));
    const gap = launch ? false : !tiny && gapRnd() < 0.13; // was 0.18 — G2: full gaps rarer
    const crumble = launch ? false : !up;
    const w = launch ? CANDLE_W : gap ? 0 : PLATFORM_W;

    plats.push({
      i,
      x: i * CANDLE_W,
      w,
      y: cY,
      bodyTop: Math.min(oY, cY),
      bodyBottom: Math.max(oY, cY),
      wickTop: hiY,
      wickBottom: loY,
      up,
      crumble,
      state: gap ? "gone" : "solid",
      crumbleT: 0,
      passed: false,
    });
  }
  // W4 graduation arc: the LAST platform of the daily level is the summit —
  // the "5 ETH graduation" of the bonding-curve climb. Deterministic: purely
  // derived from the seed-derived list above (no extra RNG, no geometry change).
  if (plats.length > 0) plats[plats.length - 1].summit = true;
  return plats;
}

// ---- World 2 — the "post-graduation buyback world" ----
// Procedurally-extended sky beyond the summit. Chunked generation is driven by
// the engine as the camera advances; every chunk is derived ONLY from
// mulberry32(hashString(seedStr + ":world2")) consumed sequentially with a
// FIXED number of draws per platform (4), so the same seed + same advance
// steps always produce identical terrain. No Date.now(), no Math.random().
export const WORLD2_CHUNK = 24; // platforms generated per chunk

export function genWorld2Chunk(
  startIdx: number,
  count: number,
  prevY: number,
  rnd: () => number,
): Platform[] {
  const out: Platform[] = [];
  let y = prevY;
  for (let k = 0; k < count; k++) {
    const i = startIdx + k;
    // fixed draw order: up-bias, gap, rise, drop (4 draws per platform, always)
    const rUp = rnd();
    const rGap = rnd();
    const rRise = rnd();
    const rDrop = rnd();
    const up = rUp < 0.6; // green-biased sky: the climb keeps going up
    const gap = rGap < 0.15;
    const rise = 34 + rRise * 82; // 34..116px upward (y decreases) — within jump reach
    const drop = 30 + rDrop * 140; // 30..170px downward
    // same fairness clamps as buildPlatforms
    y = Math.max(y - MAX_DOWN, Math.min(y + MAX_UP, up ? y - rise : y + drop));
    out.push({
      i,
      x: i * CANDLE_W,
      w: gap ? 0 : PLATFORM_W,
      y,
      bodyTop: y + 12,
      bodyBottom: y + 54,
      wickTop: y - 10,
      wickBottom: y + 76,
      up,
      crumble: !up,
      state: gap ? "gone" : "solid",
      crumbleT: 0,
      passed: false,
    });
  }
  return out;
}
