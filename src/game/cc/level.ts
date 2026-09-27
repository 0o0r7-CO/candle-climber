// Level builder: candles -> playable platforms (rolling-normalized heights)
import type { Candle, Platform } from "./types";
import { hashString, mulberry32 } from "./rng";

export const CANDLE_W = 96;
export const PLATFORM_W = 62;
export const AMP_MIN = 150; // px between rolling low/high closes
export const AMP_MAX = 330;

const LAUNCH_PAD = 4; // first N candles: flat, contiguous, safe runway
const MAX_UP = 112;   // jump reach ≈ 137px — keep every step reachable
const MAX_DOWN = 170;

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
    const gap = launch ? false : !tiny && gapRnd() < 0.18;
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
  return plats;
}
