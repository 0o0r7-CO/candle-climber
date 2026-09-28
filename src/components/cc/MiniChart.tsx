"use client";

// Tiny real-candle chart shown on the ready screen — makes the
// "the chart is the level" connection visible without explanation.
import { useEffect, useRef } from "react";
import type { Candle } from "@/game/cc/types";

export default function MiniChart({
  candles,
  w = 320,
  h = 84,
}: {
  candles: Candle[];
  w?: number;
  h?: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const slice = candles.slice(-40);
    if (!slice.length) return;
    let min = Infinity;
    let max = -Infinity;
    for (const c of slice) {
      if (c.l < min) min = c.l;
      if (c.h > max) max = c.h;
    }
    const span = max - min || 1;
    const pad = 7;
    const cw = (w - pad * 2) / slice.length;
    const y = (v: number) => pad + (1 - (v - min) / span) * (h - pad * 2);

    for (let i = 0; i < slice.length; i++) {
      const c = slice[i];
      const up = c.c >= c.o;
      const cx = pad + i * cw + cw / 2;
      // wick
      ctx.strokeStyle = up ? "rgba(91,208,138,0.7)" : "rgba(224,120,86,0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, y(c.h));
      ctx.lineTo(cx, y(c.l));
      ctx.stroke();
      // body
      ctx.fillStyle = up ? "#5BD08A" : "#E07856";
      const top = y(Math.max(c.o, c.c));
      const bot = y(Math.min(c.o, c.c));
      const bw = Math.max(3, cw * 0.62);
      ctx.fillRect(cx - bw / 2, top, bw, Math.max(2, bot - top));
    }
  }, [candles, w, h]);

  return <canvas ref={ref} style={{ width: w, height: h }} className="cc-mini-chart" aria-hidden="true" />;
}
