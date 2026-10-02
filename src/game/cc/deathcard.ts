// Death card generator — 1080x1350 share PNG (X-optimized)
import { COLORS } from "./render";
import type { RunResult } from "./types";

// ---- P3.1 rivalry tag: pure normalizer so W5 can pin the contract canvas-free ----
// X handles: 1–15 of [A-Za-z0-9_], one optional leading @ tolerated. Anything
// else (spaces, emoji, >15) → null: the card simply omits the stamp, never
// renders a broken/mangled handle. Honest input, honest output.
export function normalizeRivalTag(raw: string): string | null {
  const h = raw.trim().replace(/^@+/, "");
  return /^[A-Za-z0-9_]{1,15}$/.test(h) ? "@" + h : null;
}

// P3.5: honest timeframe label on the card (the terrain IS the timeframe)
const TF_LABEL: Record<string, string> = {
  "1w": "WEEKLY CHART",
  "1d": "DAILY CHART",
  "4h": "4H CHART",
  "1h": "1H CHART",
};

const CAUSE_LINES: Record<string, string> = {
  fell: "LIQUIDATED. Fell out of the chart.",
  crumbled: "PAPERHANDED. The candle crumbled under you.",
  wicked: "WICKED. Spiked by the wick.",
};

// ---- W4 graduation arc: card milestone variant ----
// Pure helper (no canvas) so tests can assert the variant logic without a DOM.
// Game-fiction only — honest milestone language, no reward/yield promises.
export interface MilestoneLines {
  ribbon: string | null; // "GRADUATED" headline ribbon, null for plain deaths
  sub: string | null; // summit flavor line
  world2Line: string | null; // present when the run reached world 2
}

export function milestoneLines(r: Pick<RunResult, "graduated" | "world2">): MilestoneLines {
  if (!r.graduated) return { ribbon: null, sub: null, world2Line: null };
  return {
    ribbon: "GRADUATED",
    sub: "curve summit reached · graduation: 5 eth class",
    world2Line: r.world2 ? "world 2 reached · post-grad ×2" : null,
  };
}

interface CardOpts {
  result: RunResult;
  symbol: string;
  date: string;
  best: number;
  mutationName?: string;
  rivalName?: string;
  rivalGap?: number;
  isTop?: boolean;
  realMovePct?: number;
  difficulty?: string;
  rivalTag?: string; // P3.1: normalized "@handle" challenge stamp (null/undefined = omit)
  interval?: string; // P3.5: seed.interval — picks the honest chart label
  duelCode?: string; // P7.3: live duel code — the card carries the invitation
}

export async function makeDeathCard(o: CardOpts): Promise<Blob | null> {
  const W = 1080, H = 1350;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) return null;

  // bg
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);
  // subtle grid
  ctx.strokeStyle = "rgba(36,40,44,0.6)";
  ctx.lineWidth = 1;
  for (let y = 60; y < H; y += 90) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  const display = "600 84px 'Clash Display', 'Instrument Sans', sans-serif";
  const mono = "500 44px 'JetBrains Mono', monospace";

  // header
  ctx.fillStyle = COLORS.lime;
  ctx.font = display;
  ctx.fillText("CANDLE CLIMBER", 72, 150);
  ctx.fillStyle = COLORS.faint;
  ctx.font = mono;
  ctx.fillText("the chart is the level", 74, 205);

  // symbol chip
  ctx.fillStyle = COLORS.card;
  roundRect(ctx, 72, 280, 460, 110, 20);
  ctx.fill();
  ctx.strokeStyle = COLORS.hairline;
  ctx.lineWidth = 3;
  roundRect(ctx, 72, 280, 460, 110, 20);
  ctx.stroke();
  ctx.fillStyle = COLORS.lime;
  ctx.font = "700 56px 'JetBrains Mono', monospace";
  ctx.fillText(o.symbol, 104, 352);
  ctx.fillStyle = COLORS.faint;
  ctx.font = "400 30px 'JetBrains Mono', monospace";
  ctx.fillText(o.date + " · " + (TF_LABEL[o.interval ?? "1d"] ?? "DAILY CHART"), 104, 400);

  // real-market legibility line — "you died on the REAL chart"
  if (typeof o.realMovePct === "number") {
    const pct = `${o.realMovePct >= 0 ? "+" : ""}${o.realMovePct.toFixed(1)}%`;
    ctx.fillStyle = o.realMovePct >= 0 ? COLORS.up : COLORS.down;
    ctx.font = "500 28px 'JetBrains Mono', monospace";
    const diff = o.difficulty ? ` · ${o.difficulty}` : "";
    ctx.fillText(`REAL MOVE ${pct}${diff}`, 72, 455);
  }

  // mini candles deco (right side)
  drawMiniCandles(ctx, 620, 300, 390, 90);

  // score block
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 240px 'Clash Display', sans-serif";
  ctx.fillText(String(o.result.score), 66, 660);
  ctx.fillStyle = COLORS.faint;
  ctx.font = "500 40px 'JetBrains Mono', monospace";
  ctx.fillText("SCORE", 74, 715);

  // stats row
  const stats: [string, string][] = [
    ["CANDLES", String(o.result.candlesPassed)],
    ["BEST STREAK", "x" + String(o.result.bestStreak)],
    ["PERSONAL BEST", String(Math.max(o.best, o.result.score))],
  ];
  let sx = 72;
  for (const [k, v] of stats) {
    ctx.fillStyle = COLORS.card;
    roundRect(ctx, sx, 790, 290, 150, 18);
    ctx.fill();
    ctx.strokeStyle = COLORS.hairline;
    ctx.lineWidth = 2;
    roundRect(ctx, sx, 790, 290, 150, 18);
    ctx.stroke();
    ctx.fillStyle = COLORS.faint;
    ctx.font = "400 26px 'JetBrains Mono', monospace";
    ctx.fillText(k, sx + 24, 850);
    ctx.fillStyle = COLORS.up;
    ctx.font = "700 54px 'JetBrains Mono', monospace";
    ctx.fillText(v, sx + 24, 912);
    sx += 314;
  }

  // cause line / graduation milestone block (W4)
  const ms = milestoneLines(o.result);
  const causeLine = o.result.cause ? (CAUSE_LINES[o.result.cause] ?? CAUSE_LINES.fell) : null;
  if (ms.ribbon) {
    // graduated variant: gold milestone block replaces cause/mutation/rival copy
    let my = 1010;
    ctx.fillStyle = COLORS.gold;
    ctx.font = "600 46px 'Clash Display', sans-serif";
    ctx.fillText(ms.ribbon, 72, my);
    my += 52;
    if (ms.sub) {
      ctx.fillStyle = COLORS.faint;
      ctx.font = "500 27px 'JetBrains Mono', monospace";
      ctx.fillText(ms.sub, 72, my);
      my += 42;
    }
    if (ms.world2Line) {
      ctx.fillStyle = COLORS.lime;
      ctx.font = "500 27px 'JetBrains Mono', monospace";
      ctx.fillText(ms.world2Line, 72, my);
      my += 42;
    }
    if (causeLine) {
      // the run later ended (world 2 liquidation) — keep it honest, lowercase
      ctx.fillStyle = COLORS.down;
      ctx.font = "500 26px 'JetBrains Mono', monospace";
      ctx.fillText(causeLine.toLowerCase(), 72, my);
    }
  } else if (causeLine) {
    // cause line
    ctx.fillStyle = COLORS.down;
    ctx.font = "600 40px 'Clash Display', sans-serif";
    ctx.fillText(causeLine, 72, 1010);

    // mutation line (when today's chart is mutated)
    let y = 1062;
    if (o.mutationName) {
      ctx.fillStyle = "#8A82E8";
      ctx.font = "500 30px 'JetBrains Mono', monospace";
      ctx.fillText("MUTATION: " + o.mutationName, 72, y);
      y += 52;
    }

    // rival line — the competitive hook
    if (o.isTop) {
      ctx.fillStyle = COLORS.lime;
      ctx.font = "600 42px 'Clash Display', sans-serif";
      ctx.fillText("YOU'RE #1 ON TODAY'S CHART", 72, y);
    } else if (o.rivalName && o.rivalGap) {
      ctx.fillStyle = COLORS.faint;
      ctx.font = "600 36px 'Clash Display', sans-serif";
      ctx.fillText(`TOP: ${o.rivalName.toUpperCase().slice(0, 14)} — ${o.rivalGap.toLocaleString()} PTS AHEAD`, 72, y);
    }
  }

  // mascot face (our blockbot, original)
  drawBotFace(ctx, 72, 1160, 110);

  // P3.1 rivalry stamp — the mockery hook that pulls the rival's audience in.
  // Sits above the CTA, same x as the footer text, never overlaps the bot face.
  if (o.rivalTag) {
    ctx.fillStyle = COLORS.gold;
    ctx.font = "600 32px 'Clash Display', sans-serif";
    ctx.fillText(`CHALLENGE ISSUED → ${o.rivalTag} — YOU'RE UP`, 230, 1178);
  }

  // P7.3 duel stamp — when a duel was created from THIS run, the card doubles
  // as the invitation: the code is all a rival needs (?duel=CODE deep link).
  if (o.duelCode) {
    ctx.fillStyle = COLORS.gold;
    ctx.font = "600 34px 'JetBrains Mono', monospace";
    ctx.fillText(`DUEL ${o.duelCode} — BEAT THIS RUN`, 230, o.rivalTag ? 1132 : 1178);
  }

  // footer
  ctx.fillStyle = COLORS.lime;
  ctx.font = "600 38px 'Clash Display', sans-serif";
  ctx.fillText("BEAT MY RUN →", 230, 1225);
  ctx.fillStyle = COLORS.faint;
  ctx.font = "400 30px 'JetBrains Mono', monospace";
  ctx.fillText("vibe/vibe builders · robinhood chain testnet", 72, 1290);

  return new Promise((resolve) => c.toBlob((b) => resolve(b), "image/png", 0.92));
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

function drawMiniCandles(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const rnd = (i: number) => Math.sin(i * 12.9898) * 43758.5453 % 1;
  const n = 9;
  const cw = w / n;
  for (let i = 0; i < n; i++) {
    const r = Math.abs(rnd(i));
    const up = r > 0.42;
    const bodyH = 30 + r * (h - 60);
    const bx = x + i * cw + cw * 0.2;
    const by = y + (h - bodyH) * (0.2 + 0.6 * Math.abs(rnd(i + 40)));
    ctx.strokeStyle = up ? "rgba(91,208,138,0.5)" : "rgba(224,120,86,0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx + cw * 0.3, by - 14);
    ctx.lineTo(bx + cw * 0.3, by + bodyH + 14);
    ctx.stroke();
    ctx.fillStyle = up ? COLORS.up : COLORS.down;
    roundRect(ctx, bx, by, cw * 0.6, bodyH, 5);
    ctx.fill();
  }
}

function drawBotFace(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = "#2A2F34";
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 4;
  roundRect(ctx, x, y + s * 0.2, s, s * 0.7, 14);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#B8722C";
  roundRect(ctx, x, y, s, s * 0.3, 10);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = COLORS.lime;
  roundRect(ctx, x + s * 0.12, y + s * 0.06, s * 0.3, s * 0.2, 5); ctx.fill();
  roundRect(ctx, x + s * 0.58, y + s * 0.06, s * 0.3, s * 0.2, 5); ctx.fill();
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x + s / 2, y + s * 0.55, s * 0.22, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
}
