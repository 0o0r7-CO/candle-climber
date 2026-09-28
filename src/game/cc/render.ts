// Canvas renderer — locked vibe/vibe design language
import { Engine, VIEW_W, VIEW_H, type FloatText } from "./engine";
import { CANDLE_W } from "./level";
import type { Platform, Particle } from "./types";

export const COLORS = {
  bg: "#101214",
  bgDeep: "#0C0E10",
  card: "#16191C",
  hairline: "#24282C",
  lime: "#CCFF00",
  up: "#5BD08A",
  upDeep: "#0F7A40",
  down: "#E07856",
  ink: "#0E1400",
  purple: "#6A63C8",
  faint: "#5E636B",
  gold: "#E0B04E",
};

export function drawPlatform(ctx: CanvasRenderingContext2D, p: Platform, camX: number, camY: number) {
  if (p.state === "gone" || p.w === 0) return;
  const x = p.x - camX;
  const y = p.y - camY;
  if (x > VIEW_W + 40 || x + p.w < -40) return;

  // wick line
  const wx = x + p.w / 2;
  const wTop = p.wickTop - camY;
  const wBot = p.wickBottom - camY;
  ctx.strokeStyle = p.up ? "rgba(91,208,138,0.45)" : "rgba(224,120,86,0.45)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(wx, wTop);
  ctx.lineTo(wx, wBot);
  ctx.stroke();

  // body
  const bTop = p.bodyTop - camY;
  const bBot = p.bodyBottom - camY;
  let shakeX = 0;
  if (p.state === "crumbling") shakeX = (Math.random() - 0.5) * 6 * (1 + p.crumbleT * 8);
  const bodyH = Math.max(6, bBot - bTop);
  const cx = x + shakeX;

  ctx.fillStyle = p.up ? COLORS.up : COLORS.down;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 3;
  roundRect(ctx, cx, bTop, p.w, bodyH, 6);
  ctx.fill();
  ctx.stroke();

  // platform surface cap (the walkable top)
  const capColor = p.up ? COLORS.lime : "#F0A48E";
  ctx.fillStyle = capColor;
  roundRect(ctx, cx - 2, p.y - camY - 4, p.w + 4, 8, 4);
  ctx.fill();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  roundRect(ctx, cx - 2, p.y - camY - 4, p.w + 4, 8, 4);
  ctx.stroke();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawPlayer(ctx: CanvasRenderingContext2D, e: Engine) {
  const x = e.px - e.camX;
  const y = e.py - e.camY;
  ctx.save();
  if (e.dead) {
    ctx.translate(x + 17, y + 20);
    ctx.rotate(Math.min(Math.PI, e.deathT * 6));
    ctx.translate(-(x + 17), -(y + 20));
  }
  // body — chunky blockbot
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
  // square glasses with lime glow (our mascot signature)
  ctx.shadowColor = COLORS.lime;
  ctx.shadowBlur = 10;
  ctx.fillStyle = COLORS.lime;
  roundRect(ctx, x + 4, y + 2, 10, 8, 2); ctx.fill();
  roundRect(ctx, x + 20, y + 2, 10, 8, 2); ctx.fill();
  ctx.shadowBlur = 0;
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

function drawParticles(ctx: CanvasRenderingContext2D, ps: Particle[], camX: number, camY: number) {
  for (const q of ps) {
    ctx.globalAlpha = Math.max(0, q.life / q.maxLife);
    ctx.fillStyle = q.color;
    ctx.fillRect(q.x - camX - q.size / 2, q.y - camY - q.size / 2, q.size, q.size);
  }
  ctx.globalAlpha = 1;
}

function drawFloats(ctx: CanvasRenderingContext2D, fs: FloatText[], camX: number, camY: number) {
  ctx.font = "700 17px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  for (const f of fs) {
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life / f.maxLife));
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x - camX, f.y - camY);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";
}

function drawHints(ctx: CanvasRenderingContext2D, e: Engine) {
  if (!e.showHints || e.candlesPassed > 6) return;
  const bubbles: Record<number, string> = {
    0: "TAP / SPACE = JUMP",
    1: "HOLD = JUMP HIGHER",
  };
  for (let i = 0; i <= Math.min(7, e.plats.length - 1); i++) {
    if (e.plats[i]?.crumble) bubbles[i] = "RED = DON'T LINGER";
  }
  if (e.plats[4] && !bubbles[4]) bubbles[4] = "GREEN STREAK = COMBO";
  const bob = Math.sin(e.time * 3) * 3;
  ctx.font = "600 13px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  for (const [k, text] of Object.entries(bubbles)) {
    const p = e.plats[Number(k)];
    if (!p || p.passed || p.state === "gone") continue;
    const x = p.x - e.camX + p.w / 2;
    const yTop = p.y - e.camY - 58 - (Number(k) % 2) * 38 + bob;
    const tw = ctx.measureText(text).width + 22;
    ctx.fillStyle = "rgba(22,25,28,0.92)";
    ctx.strokeStyle = COLORS.hairline;
    ctx.lineWidth = 1.5;
    roundRect(ctx, x - tw / 2, yTop, tw, 26, 8);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 5, yTop + 25);
    ctx.lineTo(x + 5, yTop + 25);
    ctx.lineTo(x, yTop + 32);
    ctx.closePath();
    ctx.fillStyle = "rgba(22,25,28,0.92)";
    ctx.fill();
    ctx.fillStyle = COLORS.lime;
    ctx.fillText(text, x, yTop + 17);
  }
  ctx.textAlign = "left";
}

function drawBackdrop(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // horizontal price grid
  ctx.strokeStyle = "rgba(36,40,44,0.7)";
  ctx.lineWidth = 1;
  const gridStep = 90;
  const startY = -((camY % gridStep) + gridStep) % gridStep;
  ctx.beginPath();
  for (let y = startY; y < VIEW_H; y += gridStep) {
    ctx.moveTo(0, y); ctx.lineTo(VIEW_W, y);
  }
  ctx.stroke();
  // depth glow at bottom (the "abyss")
  const g = ctx.createLinearGradient(0, VIEW_H - 130, 0, VIEW_H);
  g.addColorStop(0, "rgba(12,14,16,0)");
  g.addColorStop(1, "rgba(224,120,86,0.10)");
  ctx.fillStyle = g;
  ctx.fillRect(0, VIEW_H - 130, VIEW_W, 130);
}

export function render(ctx: CanvasRenderingContext2D, e: Engine) {
  ctx.save();
  const sx = e.shake > 0 ? (Math.random() - 0.5) * e.shake : 0;
  const sy = e.shake > 0 ? (Math.random() - 0.5) * e.shake : 0;
  ctx.translate(sx, sy);
  drawBackdrop(ctx, e.camX, e.camY);

  // visible platforms only
  const i0 = Math.max(0, Math.floor(e.camX / CANDLE_W) - 2);
  const i1 = Math.min(e.plats.length - 1, Math.ceil((e.camX + VIEW_W) / CANDLE_W) + 2);
  for (let i = i0; i <= i1; i++) drawPlatform(ctx, e.plats[i], e.camX, e.camY);

  drawHints(ctx, e);
  drawParticles(ctx, e.particles, e.camX, e.camY);
  drawFloats(ctx, e.floats, e.camX, e.camY);
  if (!e.dead || e.deathT < 2.2) drawPlayer(ctx, e);

  // progress candle ticker (top center, in-canvas)
  const passed = e.plats[Math.min(e.candlesPassed, e.plats.length - 1)];
  if (passed) {
    ctx.fillStyle = "rgba(204,255,0,0.12)";
    ctx.fillRect(0, 0, VIEW_W, 3);
  }
  ctx.restore();
}
