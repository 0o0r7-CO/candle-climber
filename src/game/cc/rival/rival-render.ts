// P7.1 rival rendering — translucent ghost climber, shared by BOTH renderers.
// DECOR-ONLY: reads the rival's headless engine state and draws it inside the
// HUMAN's camera frame. Zero gameplay/physics/scoring reads on the human side;
// the human's submission flow is untouched (W5 anti-cheat red line held).
//
// Note: this module deliberately does NOT import render.ts (which imports it
// back) — the tiny rect helper + colors are local so the graph stays acyclic.
import { Engine, VIEW_W, VIEW_H } from "../engine";
import { getChar, type CharDef } from "../characters";
import type { RivalBot } from "./bot";

/** Spec band 0.45–0.6 — reads as "there, but not really there". */
export const RIVAL_ALPHA = 0.52;
const LIME = "#CCFF00";

interface RivalSprite {
  img: HTMLImageElement;
  ok: boolean;
  def: CharDef;
}
// module-level sprite cache — images load once per char id (client only)
const rivalSprites = new Map<string, RivalSprite>();

function ensureRivalSprite(def: CharDef): RivalSprite | null {
  if (!def.sheet || typeof window === "undefined" || typeof document === "undefined") return null;
  let cs = rivalSprites.get(def.id);
  if (!cs) {
    const img = new Image();
    cs = { img, ok: false, def };
    img.onload = () => { if (cs) cs.ok = true; };
    img.onerror = () => { if (cs) cs.ok = false; };
    img.src = def.sheet; // same-origin public asset
    rivalSprites.set(def.id, cs);
  }
  return cs.ok ? cs : null;
}

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

/** Draw the rival inside the human's frame — own skin, ghost alpha, RIVAL tag. */
export function drawRival(ctx: CanvasRenderingContext2D, human: Engine, bot: RivalBot) {
  const r = bot.eng;
  if (r.dead) return; // respawn is instant + cold — no corpse to draw
  const x = r.px - human.camX;
  const y = r.py - human.camY;
  if (x < -70 || x > VIEW_W + 70 || y < -90 || y > VIEW_H + 90) return; // off-screen

  const def = getChar(bot.charId);
  const cs = def.sheet ? ensureRivalSprite(def) : null;
  ctx.save();
  ctx.globalAlpha = RIVAL_ALPHA;
  if (cs) {
    // same 9fps frame cadence as the human's sprite, driven by the rival's own clock
    const fi = Math.floor(r.time * 9) % Math.max(1, def.frames.length);
    const f = def.frames[fi] ?? def.frames[0];
    if (f) {
      const destH = 52;
      const destW = (f.w / def.frameH) * destH;
      const dx = Math.round(x + 17 - destW / 2);
      const dy = Math.round(y + 40 - destH);
      ctx.drawImage(cs.img, f.x, f.y, f.w, f.h, dx, dy, destW, destH);
    }
  } else {
    // procedural fallback body (the rival pick always has a sheet; belt+braces)
    ctx.fillStyle = "#2A2F34";
    ghostRect(ctx, x, y + 8, 34, 28, 6);
    ctx.fill();
  }
  // distinguishing FX (spec: thin outline and/or chip): both, subtle
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = LIME;
  ctx.lineWidth = 1;
  ghostRect(ctx, x - 2, y + 2, 38, 42, 7);
  ctx.stroke();
  ctx.font = "700 9px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = LIME;
  ctx.fillText("RIVAL", x + 17, y - 5);
  ctx.textAlign = "left";
  ctx.restore();
}
