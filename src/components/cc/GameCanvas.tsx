"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Engine, VIEW_W, VIEW_H } from "@/game/cc/engine";
import { buildPlatforms } from "@/game/cc/level";
import { render, COLORS } from "@/game/cc/render";
import { makeDeathCard } from "@/game/cc/deathcard";
import { sfx, unlockAudio } from "@/game/cc/sound";
import { hashString } from "@/game/cc/rng";
import type { CandleData, RunResult } from "@/game/cc/types";

type Phase = "loading" | "ready" | "running" | "dead";
interface BoardEntry { name: string; score: number; candlesPassed: number; date: string }

const BEST_KEY = "cc_best_v1";
const NAME_KEY = "cc_name_v1";

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const rafRef = useRef<number>(0);
  const lastRef = useRef<number>(0);
  const accRef = useRef<number>(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [data, setData] = useState<CandleData | null>(null);
  const [hud, setHud] = useState({ score: 0, combo: 0 });
  const [result, setResult] = useState<RunResult | null>(null);
  const [best, setBest] = useState(0);
  const [name, setName] = useState("");
  const [board, setBoard] = useState<BoardEntry[]>([]);
  const [rank, setRank] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [muted, setMuted] = useState(false);

  // load daily level
  useEffect(() => {
    let alive = true;
    setBest(Number(localStorage.getItem(BEST_KEY) ?? 0));
    setName(localStorage.getItem(NAME_KEY) ?? "");
    fetch("/api/candles")
      .then((r) => r.json())
      .then((d: CandleData) => { if (alive) { setData(d); setPhase("ready"); } })
      .catch(() => {
        if (!alive) return;
        setData({ seed: { date: "SYNTH", symbol: "SYNTHUSDT", interval: "1w", source: "synthetic" }, candles: [] });
        setPhase("ready");
      });
    return () => { alive = false; cancelAnimationFrame(rafRef.current); };
  }, []);

  const buildEngine = useCallback((d: CandleData) => {
    const plats = buildPlatforms(d.candles, d.seed.date + d.seed.symbol);
    return new Engine(plats, {
      onScore: (score, combo) => setHud({ score, combo }),
      onDeath: (r) => {
        sfx.death();
        setResult(r);
        setPhase("dead");
        setHud({ score: r.score, combo: 0 });
        if (r.score > Number(localStorage.getItem(BEST_KEY) ?? 0)) {
          localStorage.setItem(BEST_KEY, String(r.score));
          setBest(r.score);
        }
      },
    });
  }, []);

  const startRun = useCallback(() => {
    if (!data) return;
    unlockAudio();
    const eng = buildEngine(data);
    engineRef.current = eng;
    setHud({ score: 0, combo: 0 });
    setResult(null);
    setRank(null);
    setPhase("running");
    lastRef.current = performance.now();
    accRef.current = 0;
  }, [data, buildEngine]);

  // main loop
  useEffect(() => {
    if (phase !== "running" && phase !== "dead") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr * rect.width / VIEW_W, 0, 0, dpr * rect.width / VIEW_W, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const step = (now: number) => {
      const e = engineRef.current;
      if (!e) return;
      let dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      dt = Math.min(0.1, dt);
      accRef.current += dt;
      const FIXED = 1 / 60;
      while (accRef.current >= FIXED) {
        e.step(FIXED);
        accRef.current -= FIXED;
      }
      ctx.clearRect(0, 0, VIEW_W, VIEW_H);
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      render(ctx, e);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [phase]);

  // input
  useEffect(() => {
    const down = (ev: KeyboardEvent) => {
      if (ev.repeat) return;
      if (ev.code === "Space" || ev.code === "ArrowUp" || ev.code === "KeyW") {
        ev.preventDefault();
        if (phase === "ready" || phase === "dead") startRun();
        else engineRef.current?.press();
      }
    };
    const up = (ev: KeyboardEvent) => {
      if (ev.code === "Space" || ev.code === "ArrowUp" || ev.code === "KeyW") engineRef.current?.release();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [phase, startRun]);

  const onPointerDown = (ev: React.PointerEvent) => {
    ev.preventDefault();
    if (phase === "ready") { startRun(); return; }
    engineRef.current?.press();
  };
  const onPointerUp = () => engineRef.current?.release();

  const submitScore = async () => {
    if (!result || !data || submitting) return;
    setSubmitting(true);
    try {
      const finalName = (name.trim() || "ANON").slice(0, 14);
      localStorage.setItem(NAME_KEY, finalName);
      const res = await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: finalName, score: result.score, candlesPassed: result.candlesPassed,
          symbol: data.seed.symbol, date: data.seed.date,
        }),
      });
      const j = await res.json();
      if (typeof j.rank === "number") setRank(j.rank);
      const b = await fetch(`/api/leaderboard?date=${data.seed.date}`).then((r) => r.json());
      setBoard(b.entries ?? []);
    } finally {
      setSubmitting(false);
    }
  };

  const downloadCard = async () => {
    if (!result || !data) return;
    const blob = await makeDeathCard({ result, symbol: data.seed.symbol, date: data.seed.date, best });
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `candle-climber-${result.score}.png`;
    a.click();
    URL.revokeObjectURL(url);
    if (navigator.share && navigator.canShare?.({ files: [new File([blob], "card.png", { type: "image/png" })] })) {
      try {
        await navigator.share({ files: [new File([blob], "card.png", { type: "image/png" })], title: "Candle Climber" });
      } catch { /* user cancelled */ }
    }
  };

  const seedLabel = data ? `${data.seed.symbol} · ${data.seed.date}` : "";

  return (
    <div className="cc-root" onContextMenu={(e) => e.preventDefault()}>
      {/* HUD */}
      <div className="cc-hud">
        <div className="cc-chip cc-chip-lime">{seedLabel}</div>
        <div className="cc-hud-right">
          <div className="cc-chip cc-chip-score">{hud.score.toLocaleString()}</div>
          {hud.combo > 1 && <div className="cc-chip cc-chip-combo">x{(1 + Math.min(hud.combo, 12) * 0.5).toFixed(1)}</div>}
        </div>
      </div>

      {/* Canvas stage */}
      <div
        className="cc-stage"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        role="button"
        aria-label="Game area — tap or press space to jump"
        tabIndex={0}
      >
        <canvas ref={canvasRef} className="cc-canvas" />

        {phase === "loading" && (
          <div className="cc-overlay"><div className="cc-panel"><p className="cc-loading">LOADING DAILY CHART…</p></div></div>
        )}

        {phase === "ready" && data && (
          <div className="cc-overlay">
            <div className="cc-panel">
              <h1 className="cc-title">CANDLE<span>CLIMBER</span></h1>
              <p className="cc-tag">the chart is the level</p>
              <div className="cc-daily">
                <span className="cc-daily-label">TODAY&apos;S CHART</span>
                <span className="cc-daily-symbol">{data.seed.symbol}</span>
                <span className="cc-daily-src">{data.seed.source === "binance" ? "live data" : "synthetic"}</span>
              </div>
              <div className="cc-howto">
                <p><b className="lime">GREEN</b> candles hold. <b className="coral">RED</b> candles crumble.</p>
                <p>Tap / Space to jump. One chart. Every player. Daily.</p>
              </div>
              <button className="cc-btn cc-btn-start" onClick={startRun}>START CLIMB</button>
              {best > 0 && <p className="cc-best">PERSONAL BEST <b>{best.toLocaleString()}</b></p>}
            </div>
          </div>
        )}

        {phase === "dead" && result && (
          <div className="cc-overlay">
            <div className="cc-panel cc-panel-death">
              <h2 className="cc-liquidated">LIQUIDATED</h2>
              <div className="cc-death-score">
                <span className="cc-death-num">{result.score.toLocaleString()}</span>
                <span className="cc-death-sub">
                  {result.candlesPassed} candles · best streak x{result.bestStreak} · PB {best.toLocaleString()}
                </span>
              </div>
              {rank !== null && <p className="cc-rank">GLOBAL RANK #{rank} TODAY</p>}
              <div className="cc-death-actions">
                <input
                  className="cc-input"
                  placeholder="YOUR NAME"
                  maxLength={14}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <button className="cc-btn" onClick={submitScore} disabled={submitting}>
                  {submitting ? "…" : "SUBMIT SCORE"}
                </button>
                <button className="cc-btn cc-btn-ghost" onClick={downloadCard}>DEATH CARD ↓</button>
                <button className="cc-btn cc-btn-start" onClick={startRun}>RETRY</button>
              </div>
              {board.length > 0 && (
                <div className="cc-board">
                  <div className="cc-board-title">TOP 10 · {data?.seed.symbol}</div>
                  {board.slice(0, 10).map((e, i) => (
                    <div key={`${e.ts ?? i}-${e.name}`} className="cc-board-row">
                      <span className={i < 3 ? "cc-board-rank top" : "cc-board-rank"}>#{i + 1}</span>
                      <span className="cc-board-name">{e.name}</span>
                      <span className="cc-board-score">{e.score.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <button
        className="cc-chip cc-mute"
        onClick={() => { const m = !muted; setMuted(m); unlockAudio(); }}
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? "MUTED" : "SOUND ON"}
      </button>
    </div>
  );
}
