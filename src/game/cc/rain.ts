// P3.2 candle-rain mutation variant (CC-PLAN D9 leftover) — DECOR ONLY.
// A falling-candle layer rendered BEHIND the playfield when today's mutation
// is "rain". Zero gameplay surface: no engine import cycle risk (pure math on
// passed-in dims), no physics read, no scoring path — W5 determinism untouched.
//
// Determinism contract (W5-pinned): glyph geometry is a pure function of
// (index, engine time, level seed). Same seed + same sim time ⇒ same frame,
// forever. Time comes from e.time (engine-driven), never the wall clock.
import { hashString } from "./rng";

export interface RainGlyph {
  x: number;
  y: number;
  w: number;
  h: number;
  up: boolean;
  alpha: number;
}

// Pure: glyph i at engine-time t. Same inputs ⇒ identical output (canvas-free,
// testable). Fall wraps over the top edge; slight per-glyph sway via sin(t).
export function rainGlyph(i: number, t: number, seedStr: string, w: number, h: number): RainGlyph {
  const r1 = (hashString(`cc-rain:${seedStr}:${i}`) % 1000) / 1000; // lane + size
  const r2 = (hashString(`cc-rain-v:${seedStr}:${i}`) % 1000) / 1000; // speed + depth
  const h3 = hashString(`cc-rain-s:${seedStr}:${i}`);
  const speed = 90 + r2 * 130; // px/s — slow enough to read as weather, not hazard
  const size = 3 + r1 * 5; // body width 3–8px
  const bodyH = size * (2.4 + r2 * 2.2); // tall-ish candle proportions
  const x = ((r1 * (w + 60) + (h3 % 40)) % (w + 60)) - 30 + Math.sin(t * 0.7 + i) * 6;
  const y = ((r2 * h + t * speed) % (h + 80)) - 40;
  const up = (h3 >> 3) % 10 < 3; // ~30% green — a bleeding tape with bounces
  const alpha = 0.12 + r2 * 0.2; // 0.12–0.32 — always readable-through
  return { x, y, w: size, h: bodyH, up, alpha };
}

// Draw layer: 34 glyphs, screen-space (camera-independent), low alpha, drawn
// after backdrop / before platforms so it never occludes gameplay elements.
export function drawCandleRain(ctx: CanvasRenderingContext2D, e: { time: number }, seedStr: string, w: number, h: number) {
  if (!seedStr) return;
  for (let i = 0; i < 34; i++) {
    const g = rainGlyph(i, e.time, seedStr, w, h);
    const rgb = g.up ? "91,208,138" : "224,120,86"; // same up/down palette as the card/candles
    ctx.strokeStyle = `rgba(${rgb},${(g.alpha * 0.8).toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(g.x + g.w / 2, g.y - 5);
    ctx.lineTo(g.x + g.w / 2, g.y + g.h + 5);
    ctx.stroke();
    ctx.fillStyle = `rgba(${rgb},${g.alpha.toFixed(3)})`;
    ctx.fillRect(g.x, g.y, g.w, g.h);
  }
}
