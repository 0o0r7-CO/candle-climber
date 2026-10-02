// V1 renderer (P2.1 / ART-DIRECTION §3–6): 5-layer parallax + palette materials + juice.
// RENDER-ONLY: consumes the SAME Engine the v1 renderer consumes — physics, scoring,
// determinism and anti-cheat are untouched. Terrain decor is a pure function of
// (plats, seedStr) via buildTerrainV2; transient effects use engine time only (no wall
// clock). No per-frame shadowBlur: glows are pre-rendered sprites blitted with 'lighter'.
//
// Layer stack (back → front):
//   L1 sky        deterministic palette from seed (session-time fiction)
//   L2 ghosts     colossal translucent candles of the SAME level (f=0.22)
//   L3 ridge      previous candles as mountain silhouettes   (f=0.55)
//   L4 playfield  translated terrain + walkable caps (v1 geometry, v2 materials)
//   L5 foreground ambient tick particles + vignette
import { Engine, VIEW_W, VIEW_H } from "./engine";
import { CANDLE_W, PLATFORM_W } from "./level";
import { COLORS, roundRect, drawSummit, drawHints, drawFloats, drawParticles } from "./render";
import { buildTerrainV2, type TerrainV2, type SlabDecor } from "./terrain-v2";
import { NEUTRAL_WEATHER, type Weather } from "./weather";
import { drawCandleRain } from "./rain";
import { type Wreck } from "./wreckage";
import { hashString, mulberry32 } from "./rng";
import { getChar, type CharDef } from "./characters";
import { drawRival } from "./rival/rival-render";
import type { RivalBot } from "./rival/bot";
import type { Platform } from "./types";

interface V2State {
  seedStr: string;
  terrainKey: number; // plats.length at last terrain rebuild
  terrain: TerrainV2;
  trail: { x: number; y: number }[];
  squash: number;
  stretch: number;
  prevGrounded: boolean;
  prevVy: number;
  lastTime: number;
  glow: Record<string, HTMLCanvasElement | null>;
  vignette: CanvasGradient | null;
  amb: { x: number; y: number; sp: number; s: number; a: number; ph: number }[];
}

const states = new WeakMap<Engine, V2State>();

function makeGlow(color: string): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  try {
    const c = document.createElement("canvas");
    c.width = 96;
    c.height = 96;
    const g = c.getContext("2d");
    if (!g) return null;
    const grad = g.createRadialGradient(48, 48, 2, 48, 48, 48);
    grad.addColorStop(0, color);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 96, 96);
    return c;
  } catch {
    return null;
  }
}

function getState(e: Engine, seedStr: string): V2State {
  let st = states.get(e);
  if (!st || st.seedStr !== seedStr || st.terrainKey !== e.plats.length) {
    const ambRnd = mulberry32(hashString("cc-v2-amb:" + seedStr));
    const amb: V2State["amb"] = [];
    for (let k = 0; k < 26; k++) {
      amb.push({
        x: ambRnd() * VIEW_W,
        y: ambRnd() * VIEW_H,
        sp: 7 + ambRnd() * 14,
        s: 1 + ambRnd() * 1.6,
        a: 0.08 + ambRnd() * 0.2,
        ph: ambRnd() * Math.PI * 2,
      });
    }
    const prev = st;
    st = {
      seedStr,
      terrainKey: e.plats.length,
      terrain: buildTerrainV2(e.plats, seedStr),
      trail: prev ? prev.trail : [],
      squash: 0,
      stretch: 0,
      prevGrounded: false,
      prevVy: 0,
      lastTime: e.time,
      glow: prev ? prev.glow : {},
      vignette: prev ? prev.vignette : null,
      amb,
    };
    states.set(e, st);
  }
  return st;
}

/** Generic parallax mapping: f = scroll factor (<1 = slower/deeper), k = size scale,
 *  c = world-x compression (c*f ≈ 1 keeps the layer sweeping the whole level). */
function lx(wx: number, camX: number, f: number, c: number, ax: number): number {
  return (wx * c - camX) * f + ax;
}
function ly(wy: number, camY: number, f: number, k: number, ay: number): number {
  return (wy * k - camY) * f + ay;
}

/* ------------------------------- L1 · sky -------------------------------- */

function drawSkyV2(ctx: CanvasRenderingContext2D, e: Engine, t: TerrainV2, w: Weather) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, COLORS.bgDeep);
  g.addColorStop(1, COLORS.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // signature band per sky segment: night / dawn(lime) / day(steel) / dusk(purple)
  const seg = Math.floor(t.skyPhase * 4) % 4;
  const frac = t.skyPhase * 4 - Math.floor(t.skyPhase * 4);
  const pulse = Math.sin(Math.PI * frac);
  let bandColor = "";
  let bandAlpha = 0;
  if (seg === 1) { bandColor = "204,255,0"; bandAlpha = 0.045 + pulse * 0.03; } // dawn
  else if (seg === 2) { bandColor = "94,99,107"; bandAlpha = 0.05; } // day haze
  else if (seg === 3) { bandColor = "106,99,200"; bandAlpha = 0.06 + pulse * 0.04; } // dusk
  if (bandColor) {
    const band = ctx.createLinearGradient(0, VIEW_H - 220, 0, VIEW_H);
    band.addColorStop(0, `rgba(${bandColor},0)`);
    band.addColorStop(1, `rgba(${bandColor},${bandAlpha})`);
    ctx.fillStyle = band;
    ctx.fillRect(0, VIEW_H - 220, VIEW_W, 220);
  }

  // H2 weather: high wind loads the sky with a drifting cloud veil (deterministic
  // from engine time; storm days read as storm days — mood follows the data)
  if (w.wind > 0.3) {
    const drift = ((e.time * 34 * w.windDir) % (VIEW_W + 420) + VIEW_W + 420) % (VIEW_W + 420) - 210;
    const cloud = ctx.createLinearGradient(drift - 260, 0, drift + 260, VIEW_H * 0.8);
    cloud.addColorStop(0, "rgba(16,18,20,0)");
    cloud.addColorStop(0.5, `rgba(16,18,20,${0.16 * w.wind})`);
    cloud.addColorStop(1, "rgba(16,18,20,0)");
    ctx.fillStyle = cloud;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  // price grid — dimmer than v1 (the world layers carry the depth now)
  ctx.strokeStyle = "rgba(36,40,44,0.5)";
  ctx.lineWidth = 1;
  const gridStep = 90;
  const startY = -((e.camY % gridStep) + gridStep) % gridStep;
  ctx.beginPath();
  for (let y = startY; y < VIEW_H; y += gridStep) {
    ctx.moveTo(0, y);
    ctx.lineTo(VIEW_W, y);
  }
  ctx.stroke();
}

/* ---------------------------- L2 · ghost candles -------------------------- */

const GHOST_F = 0.22, GHOST_C = 4.5, GHOST_K = 2.4, GHOST_AX = 60, GHOST_AY = 96;

function drawGhostsV2(ctx: CanvasRenderingContext2D, e: Engine, t: TerrainV2) {
  const camX = e.camX, camY = e.camY;
  const i0 = Math.max(0, Math.floor(((camX + (-240 - GHOST_AX) / GHOST_F) / GHOST_C) / CANDLE_W));
  const i1 = Math.min(e.plats.length - 1, Math.ceil(((camX + (VIEW_W + 240 - GHOST_AX) / GHOST_F) / GHOST_C) / CANDLE_W));
  ctx.save();
  for (let i = i0; i <= i1; i++) {
    const p = e.plats[i];
    if (!p || p.w === 0 || p.state === "gone") continue;
    const gx = lx(p.x + p.w / 2, camX, GHOST_F, GHOST_C, GHOST_AX);
    const gy = ly(p.bodyTop, camY, GHOST_F, GHOST_K, GHOST_AY);
    const gw = PLATFORM_W * GHOST_K;
    const gh = Math.max(10, (p.bodyBottom - p.bodyTop) * GHOST_K);
    ctx.globalAlpha = 0.055;
    ctx.fillStyle = p.up ? COLORS.up : COLORS.down;
    roundRect(ctx, gx - gw / 2, gy, gw, gh, 10);
    ctx.fill();
    // wick
    ctx.globalAlpha = 0.045;
    ctx.strokeStyle = p.up ? COLORS.up : COLORS.down;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(gx, ly(p.wickTop, camY, GHOST_F, GHOST_K, GHOST_AY));
    ctx.lineTo(gx, ly(p.wickBottom, camY, GHOST_F, GHOST_K, GHOST_AY));
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  void t;
}

/* ------------------------------- L3 · ridge ------------------------------- */

const RIDGE_F = 0.55, RIDGE_C = 1.8, RIDGE_K = 0.62, RIDGE_AX = 40, RIDGE_AY = 118;

function drawRidgeV2(ctx: CanvasRenderingContext2D, e: Engine) {
  const camX = e.camX, camY = e.camY;
  const i0 = Math.max(0, Math.floor(((camX + (-240 - RIDGE_AX) / RIDGE_F) / RIDGE_C) / CANDLE_W));
  const i1 = Math.min(e.plats.length - 1, Math.ceil(((camX + (VIEW_W + 240 - RIDGE_AX) / RIDGE_F) / RIDGE_C) / CANDLE_W));
  if (i1 < i0) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-40, VIEW_H + 40);
  let started = false;
  for (let i = i0; i <= i1; i++) {
    const p = e.plats[i];
    if (!p) continue;
    const x = lx(p.x + p.w / 2, camX, RIDGE_F, RIDGE_C, RIDGE_AX);
    const y = ly(p.bodyTop, camY, RIDGE_F, RIDGE_K, RIDGE_AY);
    if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
  }
  ctx.lineTo(VIEW_W + 40, VIEW_H + 40);
  ctx.closePath();
  ctx.fillStyle = "rgba(12,14,16,0.9)";
  ctx.fill();
  // ridge top edge
  ctx.beginPath();
  for (let i = i0; i <= i1; i++) {
    const p = e.plats[i];
    if (!p) continue;
    const x = lx(p.x + p.w / 2, camX, RIDGE_F, RIDGE_C, RIDGE_AX);
    const y = ly(p.bodyTop, camY, RIDGE_F, RIDGE_K, RIDGE_AY);
    if (i === i0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = "rgba(36,40,44,0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/* ---------------------------- L4 · playfield ------------------------------ */

function drawChasmV2(ctx: CanvasRenderingContext2D, p: Platform, camX: number, camY: number, fog: number) {
  const x = p.x - camX;
  if (x > VIEW_W + 40 || x + CANDLE_W < -40) return;
  const topY = Math.max(0, p.y - camY);
  const g = ctx.createLinearGradient(0, topY, 0, topY + 320);
  g.addColorStop(0, "rgba(12,14,16,0)");
  g.addColorStop(1, `rgba(12,14,16,${0.75 * fog})`);
  ctx.fillStyle = g;
  ctx.fillRect(x, topY, CANDLE_W, Math.max(0, VIEW_H - topY));
  ctx.strokeStyle = "rgba(36,40,44,0.28)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(x + 8, topY);
  ctx.lineTo(x + 8, VIEW_H);
  ctx.moveTo(x + CANDLE_W - 8, topY);
  ctx.lineTo(x + CANDLE_W - 8, VIEW_H);
  ctx.stroke();
  ctx.setLineDash([]);
}

function blitGlow(ctx: CanvasRenderingContext2D, st: V2State, key: string, color: string, x: number, y: number, w: number, h: number, alpha: number) {
  if (alpha <= 0.005) return;
  if (!st.glow[key]) st.glow[key] = makeGlow(color);
  const spr = st.glow[key];
  if (!spr) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha;
  ctx.drawImage(spr, x - w / 2, y - h / 2, w, h);
  ctx.restore();
}

function drawSlabV2(ctx: CanvasRenderingContext2D, e: Engine, p: Platform, d: SlabDecor, camX: number, camY: number, st: V2State) {
  const x = p.x - camX;
  if (x > VIEW_W + 40 || x + p.w < -40) return;
  if (d.gap || p.state === "gone" || p.w === 0) {
    drawChasmV2(ctx, p, camX, camY, st.terrain.fogAlpha);
    if (p.summit) drawSummit(ctx, x, p.y - camY, p.w);
    return;
  }

  const wx = x + p.w / 2;
  // wick line — SAME colors/geometry as v1 (market legibility is gameplay)
  ctx.strokeStyle = p.up ? "rgba(91,208,138,0.45)" : "rgba(224,120,86,0.45)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(wx, p.wickTop - camY);
  ctx.lineTo(wx, p.wickBottom - camY);
  ctx.stroke();

  // hanging spikes (upper wick) — dark, clearly non-interactive
  const wTopY = p.wickTop - camY;
  ctx.fillStyle = "#1A1E22";
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1;
  for (const s of d.spikes) {
    const bx = wx + s.x;
    ctx.beginPath();
    ctx.moveTo(bx - s.w, wTopY);
    ctx.lineTo(bx + s.w, wTopY);
    ctx.lineTo(bx, wTopY + s.len);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // roots (lower wick)
  const wBotY = p.wickBottom - camY;
  ctx.strokeStyle = "rgba(36,40,44,0.85)";
  ctx.lineWidth = 2;
  for (const r of d.roots) {
    const bx = wx + r.x;
    ctx.beginPath();
    ctx.moveTo(wx, wBotY - 4);
    ctx.quadraticCurveTo(bx, wBotY + r.len * 0.5, bx, wBotY + r.len);
    ctx.stroke();
  }

  // body — v1 geometry, v2 material
  const bTop = p.bodyTop - camY;
  const bBot = p.bodyBottom - camY;
  let shakeX = 0;
  if (p.state === "crumbling") shakeX = Math.sin(p.i * 13.7 + p.crumbleT * 90) * 3 * (1 + p.crumbleT * 8);
  const bodyH = Math.max(6, bBot - bTop);
  const cx = x + shakeX;

  ctx.fillStyle = p.up ? COLORS.up : COLORS.down;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 3;
  roundRect(ctx, cx, bTop, p.w, bodyH, 6);
  ctx.fill();
  ctx.stroke();

  if (p.up) {
    // living stone: upward lime veins
    ctx.strokeStyle = COLORS.lime;
    ctx.lineCap = "round";
    for (const v of d.veins) {
      const vx = cx + v.x0 * p.w;
      ctx.globalAlpha = v.a;
      ctx.lineWidth = v.w;
      ctx.beginPath();
      ctx.moveTo(vx, bTop + bodyH);
      ctx.quadraticCurveTo(vx + v.bend * p.w, bTop + bodyH * 0.45, vx + v.bend * p.w * 0.4, bTop + 5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = "butt";
  } else {
    // charred rock: ink fractures + embers
    ctx.strokeStyle = COLORS.ink;
    for (const c of d.cracks) {
      ctx.globalAlpha = c.a;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k < c.pts.length; k++) {
        const px = cx + c.pts[k][0] * p.w;
        const py = bTop + Math.min(0.98, c.pts[k][1]) * bodyH;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.fillStyle = "#F0A48E";
    for (const em of d.embers) {
      ctx.globalAlpha = em.a;
      ctx.fillRect(cx + em.x * p.w, bTop + em.y * bodyH, em.s, em.s);
    }
    ctx.globalAlpha = 1;
  }

  // walkable cap — IDENTICAL geometry to v1 (readability is gameplay)
  const capColor = p.up ? COLORS.lime : "#F0A48E";
  ctx.fillStyle = capColor;
  roundRect(ctx, cx - 2, p.y - camY - 4, p.w + 4, 8, 4);
  ctx.fill();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  roundRect(ctx, cx - 2, p.y - camY - 4, p.w + 4, 8, 4);
  ctx.stroke();

  // material glow (pre-rendered sprite — no per-frame shadowBlur)
  if (p.up) {
    blitGlow(ctx, st, "lime", "rgba(204,255,0,0.85)", cx + p.w / 2, p.y - camY, p.w * 1.9, 30, 0.08 + 0.2 * d.glow);
    // cap crystals
    ctx.fillStyle = COLORS.lime;
    for (const c of d.crystals) {
      const bx = cx + (0.5 + c.x) * p.w;
      ctx.globalAlpha = c.a;
      ctx.beginPath();
      ctx.moveTo(bx - c.s, p.y - camY - 3);
      ctx.lineTo(bx + c.s, p.y - camY - 3);
      ctx.lineTo(bx, p.y - camY - 3 - c.s * 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  if (p.summit) {
    blitGlow(ctx, st, "gold", "rgba(224,176,78,0.8)", x + (p.w > 0 ? p.w / 2 : CANDLE_W / 2), p.y - camY - 40, 90, 90, 0.22);
    drawSummit(ctx, x, p.y - camY, p.w);
  }
}

/* --------------------- P3.12 character sprite system ----------------------- */

interface CharSprite {
  img: HTMLImageElement;
  ok: boolean;
  def: CharDef;
}
// module-level sprite cache — images load once per char id (client only)
const charSprites = new Map<string, CharSprite>();

function ensureCharSprite(def: CharDef): CharSprite | null {
  if (!def.sheet || typeof window === "undefined" || typeof document === "undefined") return null;
  let cs = charSprites.get(def.id);
  if (!cs) {
    const img = new Image();
    cs = { img, ok: false, def };
    img.onload = () => { if (cs) cs.ok = true; };
    img.onerror = () => { if (cs) cs.ok = false; };
    img.src = def.sheet; // same-origin public asset
    charSprites.set(def.id, cs);
  }
  return cs.ok ? cs : null;
}

/** Blit one registry frame — bottom-center anchored on the player's feet. */
function drawCharSprite(ctx: CanvasRenderingContext2D, e: Engine, cs: CharSprite) {
  const def = cs.def;
  const fi = Math.floor(e.time * 9) % Math.max(1, def.frames.length);
  const f = def.frames[fi] ?? def.frames[0];
  if (!f) return;
  const destH = 52; // player box ~46px — sprite slightly taller for presence (hitbox untouched)
  const destW = (f.w / def.frameH) * destH;
  const dx = Math.round(e.px - e.camX + 17 - destW / 2);
  const dy = Math.round(e.py - e.camY + 40 - destH);
  ctx.drawImage(cs.img, f.x, f.y, f.w, f.h, dx, dy, destW, destH);
}

/* P3.13 vibe mood→effect profiles — DECOR-ONLY full-screen overlays.
 * Every particle/line is a pure function of (charId, engine.time) via hashString —
 * same seed+time ⇒ same frame (W5 purity). Zero gameplay/physics reads. */
function drawCharFx(ctx: CanvasRenderingContext2D, e: Engine, charId: string) {
  const fx = getChar(charId).fx;
  if (fx === "none") return;
  const t = e.time;
  const h = (k: string) => hashString(`${charId}:${k}`);
  switch (fx) {
    case "venom": {
      // red vignette pulse + deterministic glitch slices
      const pulse = 0.05 + 0.03 * Math.sin(t * 2.1);
      const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.3, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.85);
      g.addColorStop(0, "rgba(200,16,46,0)");
      g.addColorStop(1, `rgba(200,16,46,${pulse})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      const slices = 2 + (h("n") % 3);
      for (let k = 0; k < slices; k++) {
        const ph = h(`s${Math.floor(t * 6)}:${k}`);
        if (ph % 5 !== 0) continue; // ~1/5 frames slice
        const yy = ph % VIEW_H;
        const sh = 3 + (ph % 9);
        ctx.globalAlpha = 0.05 + (ph % 7) * 0.012;
        ctx.fillStyle = "#E01030";
        ctx.fillRect(0, yy, VIEW_W, sh);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "cop": {
      // cyan scanlines drifting up — surveillance feed
      ctx.globalAlpha = 0.05;
      ctx.fillStyle = "#37E0E8";
      const gap = 4;
      const off = (t * 26) % gap;
      for (let y = -gap; y < VIEW_H; y += gap) ctx.fillRect(0, y + off, VIEW_W, 1.5);
      ctx.globalAlpha = 1;
      break;
    }
    case "bull": {
      // golden halo + rising coin sparks
      const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H * 0.62, VIEW_H * 0.25, VIEW_W / 2, VIEW_H * 0.62, VIEW_H * 0.9);
      g.addColorStop(0, "rgba(224,176,78,0)");
      g.addColorStop(1, `rgba(224,176,78,${0.06 + 0.03 * Math.sin(t * 1.7)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      for (let k = 0; k < 14; k++) {
        const ph = h(`sp${k}`);
        const speed = 30 + (ph % 40);
        const yy = VIEW_H - (((ph % VIEW_H) + t * speed) % VIEW_H);
        const xx = (ph >>> 4) % VIEW_W;
        ctx.globalAlpha = 0.12 + (ph % 5) * 0.03;
        ctx.fillStyle = "#E0B04E";
        ctx.fillRect(xx, yy, 2, 2);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "frost": {
      // drifting snow + ice vignette
      for (let k = 0; k < 22; k++) {
        const ph = h(`sn${k}`);
        const speed = 22 + (ph % 30);
        const yy = (((ph % VIEW_H) + t * speed) % (VIEW_H + 8)) - 4;
        const xx = ((ph >>> 3) % VIEW_W) + Math.sin(t * 0.8 + k) * 14;
        ctx.globalAlpha = 0.14 + (ph % 4) * 0.05;
        ctx.fillStyle = "#BFE8F2";
        ctx.fillRect(xx, yy, 1.6, 1.6);
      }
      ctx.globalAlpha = 1;
      const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.36, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.92);
      g.addColorStop(0, "rgba(120,190,214,0)");
      g.addColorStop(1, "rgba(120,190,214,0.1)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      break;
    }
    case "scarf": {
      // warm rose petals drifting right
      for (let k = 0; k < 10; k++) {
        const ph = h(`p${k}`);
        const speed = 16 + (ph % 22);
        const xx = (((ph % VIEW_W) + t * speed) % (VIEW_W + 12)) - 6;
        const yy = ((ph >>> 5) % VIEW_H) + Math.sin(t * 1.1 + k * 1.7) * 18;
        ctx.globalAlpha = 0.1 + (ph % 4) * 0.04;
        ctx.fillStyle = "#E07856";
        ctx.fillRect(xx, yy, 2.4, 1.6);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "visor": {
      // lavender corner glows (calm)
      const a = 0.05 + 0.02 * Math.sin(t * 0.9);
      const g = ctx.createLinearGradient(0, VIEW_H, 0, 0);
      g.addColorStop(0, `rgba(150,120,220,${a})`);
      g.addColorStop(0.4, "rgba(150,120,220,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      break;
    }
    case "grump": {
      // moss motes sinking slowly
      for (let k = 0; k < 12; k++) {
        const ph = h(`m${k}`);
        const yy = (((ph % VIEW_H) - t * (10 + ph % 12)) % VIEW_H + VIEW_H) % VIEW_H;
        const xx = (ph >>> 2) % VIEW_W;
        ctx.globalAlpha = 0.07 + (ph % 4) * 0.02;
        ctx.fillStyle = "#5FA06A";
        ctx.fillRect(xx, yy, 2, 2);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "goblin": {
      // low whisper fog — thin streaks near the bottom
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = "#7FE0C0";
      for (let k = 0; k < 6; k++) {
        const ph = h(`f${k}`);
        const xx = (((ph % VIEW_W) + t * (12 + ph % 14)) % (VIEW_W + 90)) - 45;
        const yy = VIEW_H * 0.72 + (ph % Math.floor(VIEW_H * 0.24));
        ctx.fillRect(xx, yy, 34 + (ph % 40), 1.4);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "cadet": {
      // steel glints — sparse top-edge ticks
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = "#9FB4BC";
      for (let k = 0; k < 5; k++) {
        const ph = h(`g${Math.floor(t * 2)}:${k}`);
        if (ph % 3 !== 0) continue;
        ctx.fillRect((ph >>> 3) % VIEW_W, 2 + (ph % 5), 5, 1.2);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "trader": {
      // warm green ticker shimmer — slow horizontal bands
      ctx.globalAlpha = 0.045;
      ctx.fillStyle = "#5BD08A";
      for (let k = 0; k < 3; k++) {
        const yy = (((k * VIEW_H) / 3 + t * 9) % VIEW_H + VIEW_H) % VIEW_H;
        ctx.fillRect(0, yy, VIEW_W, 6);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "scout": {
      // neon grid — verticals fixed, horizon slowly scrolling
      ctx.globalAlpha = 0.05;
      ctx.strokeStyle = "#37E0E8";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < VIEW_W; x += 44) { ctx.moveTo(x, 0); ctx.lineTo(x, VIEW_H); }
      const oy = (t * 7) % 44;
      for (let y = -44; y < VIEW_H; y += 44) { ctx.moveTo(0, y + oy); ctx.lineTo(VIEW_W, y + oy); }
      ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
    case "cowboy": {
      // dust puffs skimming the floor
      for (let k = 0; k < 9; k++) {
        const ph = h(`d${k}`);
        const xx = (((ph % VIEW_W) + t * (26 + ph % 20)) % (VIEW_W + 40)) - 20;
        const yy = VIEW_H - 26 - (ph % 30) + Math.sin(t * 2 + k) * 3;
        ctx.globalAlpha = 0.08 + (ph % 4) * 0.02;
        ctx.fillStyle = "#C8B89A";
        ctx.fillRect(xx, yy, 3, 1.6);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "dapper": {
      // film grain — deterministic speckle field, re-keyed at 12fps
      const step = Math.floor(t * 12);
      ctx.globalAlpha = 0.05;
      ctx.fillStyle = "#E8E4D8";
      for (let k = 0; k < 40; k++) {
        const ph = h(`gr${step}:${k}`);
        ctx.fillRect((ph >>> 2) % VIEW_W, (ph >>> 9) % VIEW_H, 1.2, 1.2);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "zombie": {
      // toxic haze — green tint breathing at the edges
      const a = 0.05 + 0.025 * Math.sin(t * 1.3);
      const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H * 0.55, VIEW_H * 0.3, VIEW_W / 2, VIEW_H * 0.55, VIEW_H * 0.9);
      g.addColorStop(0, "rgba(110,200,120,0)");
      g.addColorStop(1, `rgba(110,200,120,${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      break;
    }
  }
}

/* --------------------------- player + juice -------------------------------- */

function drawPlayerV2(ctx: CanvasRenderingContext2D, e: Engine, st: V2State, charId: string) {
  const x = e.px - e.camX;
  const y = e.py - e.camY;

  // trail ribbon (renderer-side history; engine untouched)
  if (!e.dead) {
    st.trail.push({ x: e.px + 17, y: e.py + 22 });
    if (st.trail.length > 26) st.trail.shift();
  }
  if (st.trail.length > 2) {
    ctx.save();
    ctx.lineCap = "round";
    for (let k = 1; k < st.trail.length; k++) {
      const a = st.trail[k - 1], b = st.trail[k];
      const f = k / st.trail.length;
      ctx.strokeStyle = `rgba(204,255,0,${0.03 + f * 0.22})`;
      ctx.lineWidth = 0.5 + f * 2.5;
      ctx.beginPath();
      ctx.moveTo(a.x - e.camX, a.y - e.camY);
      ctx.lineTo(b.x - e.camX, b.y - e.camY);
      ctx.stroke();
    }
    ctx.restore();
  }

  // squash & stretch about the feet
  const sy = 1 - 0.16 * st.squash + 0.1 * st.stretch;
  const sx = 1 + 0.14 * st.squash - 0.07 * st.stretch;
  ctx.save();
  if (e.dead) {
    ctx.translate(x + 17, y + 20);
    ctx.rotate(Math.min(Math.PI, e.deathT * 6));
    ctx.translate(-(x + 17), -(y + 20));
  } else if (sx !== 1 || sy !== 1) {
    ctx.translate(x + 17, y + 40);
    ctx.scale(sx, sy);
    ctx.translate(-(x + 17), -(y + 40));
  }
  // P3.12: selected character sprite replaces the procedural body when loaded
  const cs = getChar(charId).sheet ? ensureCharSprite(getChar(charId)) : null;
  if (cs) {
    drawCharSprite(ctx, e, cs);
    ctx.restore();
    return;
  }
  // body — chunky blockbot (same identity as v1)
  ctx.fillStyle = "#2A2F34";
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 3;
  roundRect(ctx, x, y + 8, 34, 28, 6);
  ctx.fill(); ctx.stroke();
  // legs
  ctx.fillStyle = "#1C2125";
  const legOff = e.grounded ? 0 : Math.sin(e.time * 20) * 2;
  roundRect(ctx, x + 3, y + 34, 11, 6 + legOff, 2); ctx.fill();
  roundRect(ctx, x + 20, y + 34, 11, 6 - legOff, 2); ctx.fill();
  // head band
  ctx.fillStyle = "#B8722C";
  roundRect(ctx, x + 2, y, 30, 12, 4);
  ctx.fill(); ctx.stroke();
  // square glasses with PRE-RENDERED lime glow (no per-frame shadowBlur)
  blitGlow(ctx, st, "lime", "rgba(204,255,0,0.9)", x + 9, y + 6, 34, 26, 0.4);
  blitGlow(ctx, st, "lime", "rgba(204,255,0,0.9)", x + 25, y + 6, 34, 26, 0.4);
  ctx.fillStyle = COLORS.lime;
  roundRect(ctx, x + 4, y + 2, 10, 8, 2); ctx.fill();
  roundRect(ctx, x + 20, y + 2, 10, 8, 2); ctx.fill();
  // bridge
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + 14, y + 6); ctx.lineTo(x + 20, y + 6); ctx.stroke();
  // scarf
  ctx.fillStyle = COLORS.down;
  roundRect(ctx, x - 2 + (e.grounded ? 0 : -4), y + 20, 8, 5, 2);
  ctx.fill();
  ctx.restore();
}

/* ----------------------------- L5 · foreground ----------------------------- */

function drawForegroundV2(ctx: CanvasRenderingContext2D, e: Engine, st: V2State, w: Weather) {
  // ambient rising tick particles — pure function of engine time
  for (const q of st.amb) {
    const yy = ((q.y - e.time * q.sp) % VIEW_H + VIEW_H) % VIEW_H;
    const xx = q.x + Math.sin(e.time * 0.6 + q.ph) * 10;
    ctx.globalAlpha = q.a;
    ctx.fillStyle = COLORS.lime;
    ctx.fillRect(xx, yy, q.s, q.s);
  }
  ctx.globalAlpha = 1;

  // H2 weather: wind streaks — horizontal lines whose count/speed/alpha derive
  // from ATR wind (deterministic per index from engine time; no wall clock)
  if (w.wind > 0.12) {
    const dir = w.windDir;
    const count = 3 + Math.floor(w.wind * 22);
    ctx.strokeStyle = "rgba(174,182,188,1)";
    ctx.lineCap = "round";
    for (let k = 0; k < count; k++) {
      const h1 = hashString(`cc-wind:${k}`);
      const speed = (190 + (h1 % 9) * 34) * (0.35 + w.wind);
      const span = VIEW_W + 120;
      const x0 = ((((h1 % span) + dir * e.time * speed) % span) + span) % span;
      const xx = dir >= 0 ? x0 - 60 : span - 60 - x0;
      const yy = (h1 >>> 3) % VIEW_H;
      const len = 10 + (h1 % 17) * (1.4 + w.wind * 2.2);
      ctx.globalAlpha = 0.05 + w.wind * 0.16;
      ctx.lineWidth = 1 + ((h1 >>> 5) % 2) * 0.6;
      ctx.beginPath();
      ctx.moveTo(xx, yy);
      ctx.lineTo(xx + dir * len, yy);
      ctx.stroke();
    }
    ctx.lineCap = "butt";
  }

  // H2 weather: volume fog — a right-edge lookahead veil (density = recent
  // volume vs history; honestly data-driven per ART-DIRECTION §4)
  if (w.fog > 0.08) {
    const fg = ctx.createLinearGradient(VIEW_W * 0.45, 0, VIEW_W, 0);
    fg.addColorStop(0, "rgba(16,18,20,0)");
    fg.addColorStop(1, `rgba(16,18,20,${Math.min(0.45, w.fog * 0.5)})`);
    ctx.fillStyle = fg;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // faint full-screen mood tint
    ctx.fillStyle = `rgba(16,18,20,${w.fog * 0.07})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  // vignette (cached gradient)
  if (!st.vignette) {
    const v = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.95);
    v.addColorStop(0, "rgba(12,14,16,0)");
    v.addColorStop(1, "rgba(12,14,16,0.5)");
    st.vignette = v;
  }
  ctx.fillStyle = st.vignette;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

/* ------------------------------ H3 · wreckage ------------------------------ */

// Per-device frozen death ghosts (P2.5 minimal): translucent mini-candles at
// the exact fall point. Clusters of corpses on one wick = an honest danger
// map. Decor only — never affects terrain, physics, or scoring.
function drawWrecks(ctx: CanvasRenderingContext2D, e: Engine, wrecks: Wreck[]) {
  if (!wrecks.length) return;
  const camX = e.camX, camY = e.camY;
  // cluster counting: same 26px cell = one shared "×N" badge
  const cellCount = new Map<string, number>();
  for (const w of wrecks) {
    const k = `${Math.floor(w.x / 26)}:${Math.floor(w.y / 26)}`;
    cellCount.set(k, (cellCount.get(k) ?? 0) + 1);
  }
  for (const w of wrecks) {
    const x = w.x - camX;
    const y = w.y - camY;
    if (x < -30 || x > VIEW_W + 30 || y < -30 || y > VIEW_H + 30) continue;
    const tint =
      w.cause === "crumbled" ? "224,120,86" :
      w.cause === "wicked" ? "106,99,200" : "174,182,188";
    // ghost body + wick
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = `rgb(${tint})`;
    roundRect(ctx, x - 5, y - 8, 10, 16, 3);
    ctx.fill();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = `rgb(${tint})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y - 13);
    ctx.lineTo(x, y - 8);
    ctx.stroke();
    // cluster badge — the honest pile marker
    const n = cellCount.get(`${Math.floor(w.x / 26)}:${Math.floor(w.y / 26)}`) ?? 1;
    if (n >= 3) {
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = `rgb(${tint})`;
      ctx.font = "700 9px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(`×${n}`, x, y - 16);
      ctx.textAlign = "left";
    }
    ctx.globalAlpha = 1;
  }
}

/* --------------------------------- entry ----------------------------------- */

export function renderV2(ctx: CanvasRenderingContext2D, e: Engine, seedStr: string, weather: Weather = NEUTRAL_WEATHER, wrecks: Wreck[] = [], mutationId?: string, charId = "default", rival?: RivalBot | null) {
  const st = getState(e, seedStr);
  const t = st.terrain;

  // juice bookkeeping — engine time deltas (no wall clock)
  const dt = Math.min(0.1, Math.max(0, e.time - st.lastTime));
  st.lastTime = e.time;
  if (!st.prevGrounded && e.grounded) st.squash = 1;
  if (st.prevVy > 0 && e.vy < -200) st.stretch = 1;
  st.squash = Math.max(0, st.squash - dt * 6);
  st.stretch = Math.max(0, st.stretch - dt * 7);
  st.prevGrounded = e.grounded;
  st.prevVy = e.vy;

  ctx.save();
  const sx = e.shake > 0 ? (Math.random() - 0.5) * e.shake : 0;
  const sy = e.shake > 0 ? (Math.random() - 0.5) * e.shake : 0;
  // H2 tremor: deterministic cosmetic camera noise — red-dense tails + high
  // wind make the screen breathe; never more than ~2.2px, engine untouched
  const tremAmp = weather.tremor * 1.2 + weather.wind * 0.8;
  const tx = sx + (tremAmp > 0.05 ? Math.sin(e.time * 37) * tremAmp : 0);
  const ty = sy + (tremAmp > 0.05 ? Math.cos(e.time * 29) * tremAmp * 0.6 : 0);
  ctx.translate(tx, ty);

  drawSkyV2(ctx, e, t, weather);
  // H2 wind sway: background layers (ghosts + ridge) lean with the wind —
  // playfield caps NEVER move (market legibility is gameplay, ART-DIRECTION §1)
  ctx.save();
  if (weather.wind > 0.05) {
    ctx.translate(Math.sin(e.time * 0.9) * 7 * weather.wind * weather.windDir, Math.sin(e.time * 0.7) * 2 * weather.wind);
  }
  drawGhostsV2(ctx, e, t);
  drawRidgeV2(ctx, e);
  ctx.restore();

  // P3.2 candle-rain: decor layer between backdrop and playfield (never
  // occludes slabs/caps; engine-time driven — same seed+time ⇒ same frame)
  if (mutationId === "rain") drawCandleRain(ctx, e, seedStr, VIEW_W, VIEW_H);

  // visible window (playfield space)
  const i0 = Math.max(0, Math.floor(e.camX / CANDLE_W) - 2);
  const i1 = Math.min(e.plats.length - 1, Math.ceil((e.camX + VIEW_W) / CANDLE_W) + 2);
  for (let i = i0; i <= i1; i++) {
    const p = e.plats[i];
    const d = t.slabs[i];
    if (p && d && (p.state === "gone" || p.w === 0)) drawChasmV2(ctx, p, e.camX, e.camY, t.fogAlpha);
  }
  for (let i = i0; i <= i1; i++) {
    const p = e.plats[i];
    const d = t.slabs[i];
    if (p && d) drawSlabV2(ctx, e, p, d, e.camX, e.camY, st);
  }

  drawHints(ctx, e);
  drawParticles(ctx, e.particles, e.camX, e.camY);
  drawFloats(ctx, e.floats, e.camX, e.camY);
  if (!e.dead || e.deathT < 2.2) drawPlayerV2(ctx, e, st, charId);
  // P7.1: translucent rival ghost — decor only (own skin, RIVAL outline),
  // drawn over the playfield before the per-device wreckage layer
  if (rival) drawRival(ctx, e, rival);
  drawWrecks(ctx, e, wrecks);
  drawForegroundV2(ctx, e, st, weather);
  // P3.13: per-character mood overlay — decor only, drawn LAST (over everything,
  // still inside the shake transform), pure function of (charId, engine time)
  drawCharFx(ctx, e, charId);

  // progress candle ticker (top center, in-canvas — same as v1)
  const passed = e.plats[Math.min(e.candlesPassed, e.plats.length - 1)];
  if (passed) {
    ctx.fillStyle = "rgba(204,255,0,0.12)";
    ctx.fillRect(0, 0, VIEW_W, 3);
  }
  ctx.restore();
}
