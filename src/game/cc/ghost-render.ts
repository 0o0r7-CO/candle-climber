// P7.2 ghost rendering — replay of a recorded run's position stream as a
// translucent climber with the RECORDED player's skin. DECOR-ONLY, same layer
// as rival-render.ts: reads nothing gameplay-relevant from the human engine,
// touches nothing submittable (W5 red line).
import { VIEW_W, VIEW_H } from "./engine";
import { getChar } from "./characters";
import { ensureRivalSprite } from "./rival/rival-render";
import type { GhostView } from "./ghost";

/** Slightly fainter than the rival — a ghost is a memory, not an opponent. */
export const GHOST_ALPHA = 0.4;
const CYAN = "#7FE7F5";

function ghostRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Draw the replayed ghost inside the human's frame — recorded skin, GHOST tag. */
export function drawGhost(ctx: CanvasRenderingContext2D, camX: number, camY: number, gv: GhostView) {
  const x = gv.x - camX;
  const y = gv.y - camY;
  if (x < -70 || x > VIEW_W + 70 || y < -90 || y > VIEW_H + 90) return; // off-screen

  const def = getChar(gv.charId); // unknown id falls back to the default skin
  const cs = def.sheet ? ensureRivalSprite(def) : null;
  ctx.save();
  ctx.globalAlpha = GHOST_ALPHA;
  if (cs) {
    // same 9fps frame cadence as the rival's sprite; the ghost's clock IS the
    // human engine's clock (index lookup), so the frame freezes with the stream
    const fi = Math.floor(gv.t * 9) % Math.max(1, def.frames.length);
    const f = def.frames[gv.frozen ? 0 : fi] ?? def.frames[0];
    if (f) {
      const destH = 52;
      const destW = (f.w / def.frameH) * destH;
      const dx = Math.round(x + 17 - destW / 2);
      const dy = Math.round(y + 40 - destH);
      ctx.drawImage(cs.img, f.x, f.y, f.w, f.h, dx, dy, destW, destH);
    }
  } else {
    // procedural fallback body (belt+braces — same as the rival fallback)
    ctx.fillStyle = "#24333A";
    ghostRect(ctx, x, y + 8, 34, 28, 6);
    ctx.fill();
  }
  // distinguishing FX: thin cyan outline + tag (frozen ghosts get a "(done)" note)
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 1;
  ghostRect(ctx, x - 2, y + 2, 38, 42, 7);
  ctx.stroke();
  ctx.font = "700 9px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = CYAN;
  ctx.fillText(gv.frozen ? `${gv.name} ✗` : `GHOST ${gv.name}`, x + 17, y - 5);
  ctx.textAlign = "left";
  ctx.restore();
}
