"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Engine, VIEW_W, VIEW_H } from "@/game/cc/engine";
import { buildPlatforms } from "@/game/cc/level";
import { dailyMutation, type Mutation } from "@/game/cc/mutations";
import { marketStats, fmtPct } from "@/game/cc/market";
import { pickSeed, syntheticCandles, LIMIT } from "@/game/cc/level-source";
import { utcDateStr } from "@/game/cc/rng";
import MiniChart from "@/components/cc/MiniChart";
import { render, COLORS } from "@/game/cc/render";
import { makeDeathCard } from "@/game/cc/deathcard";
import { sfx, setMuted, unlockAudio } from "@/game/cc/sound";
import type { CandleData, RunResult } from "@/game/cc/types";

type Phase = "loading" | "ready" | "running" | "dead";
interface BoardEntry {
  name: string;
  score: number;
  candlesPassed: number;
  bestStreak?: number;
  mutation?: string;
  date: string;
  ts?: number;
}

const BEST_KEY = "cc_best_v1";
const NAME_KEY = "cc_name_v1";
const MUTE_KEY = "cc_mute_v1";
const RUNS_KEY = "cc_runs_v1";

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const rafRef = useRef<number>(0);
  const lastRef = useRef<number>(0);
  const accRef = useRef<number>(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [data, setData] = useState<CandleData | null>(null);
  const [mutation, setMutation] = useState<Mutation | null>(null);
  const [hud, setHud] = useState({ score: 0, combo: 0 });
  const [result, setResult] = useState<RunResult | null>(null);
  const [best, setBest] = useState(0);
  const [name, setName] = useState("");
  const [board, setBoard] = useState<BoardEntry[]>([]);
  const [topBoard, setTopBoard] = useState<BoardEntry[]>([]);
  const [rank, setRank] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [muted, setMutedState] = useState(false);

  // load daily level + persisted prefs
  useEffect(() => {
    let alive = true;
    setBest(Number(localStorage.getItem(BEST_KEY) ?? 0));
    setName(localStorage.getItem(NAME_KEY) ?? "");
    const savedMute = localStorage.getItem(MUTE_KEY) === "1";
    setMutedState(savedMute);
    if (savedMute) setMuted(true); // applies on next unlock
    fetch("/api/candles")
      .then((r) => r.json())
      .then((d: CandleData) => {
        if (!alive) return;
        setData(d);
        setMutation(dailyMutation(d.seed.date + d.seed.symbol));
        setPhase("ready");
        fetch(`/api/leaderboard?date=${d.seed.date}`)
          .then((r) => r.json())
          .then((b) => { if (alive) setTopBoard(b.entries ?? []); })
          .catch(() => {});
      })
      .catch(() => {
        if (!alive) return;
        // API unreachable — derive the SAME daily level client-side from the
        // shared seed (identical to what the server would serve; play never crashes).
        const date = utcDateStr();
        const { symbol } = pickSeed(date);
        const d: CandleData = {
          seed: { date, symbol, interval: "1w", source: "synthetic" },
          candles: syntheticCandles(date, LIMIT),
        };
        setData(d);
        setMutation(dailyMutation(d.seed.date + d.seed.symbol));
        setPhase("ready");
      });
    return () => { alive = false; cancelAnimationFrame(rafRef.current); };
  }, []);

  const buildEngine = useCallback((d: CandleData, mut: Mutation) => {
    const plats = buildPlatforms(d.candles, d.seed.date + d.seed.symbol);
    return new Engine(
      plats,
      {
        onScore: (score, combo) => setHud({ score, combo }),
        onSfx: (s) => sfx[s](),
        onDeath: (r) => {
          sfx.death();
          setResult(r);
          setPhase("dead");
          setHud({ score: r.score, combo: 0 });
          if (r.score > Number(localStorage.getItem(BEST_KEY) ?? 0)) {
            localStorage.setItem(BEST_KEY, String(r.score));
            setBest(r.score);
          }
          // refresh today's top so the rival line + board stay fresh
          fetch(`/api/leaderboard?date=${d.seed.date}`)
            .then((res) => res.json())
            .then((b) => setTopBoard(b.entries ?? []))
            .catch(() => {});
        },
      },
      mut.mods,
    );
  }, []);

  const startRun = useCallback(() => {
    if (!data || !mutation || data.candles.length === 0) return;
    unlockAudio();
    const eng = buildEngine(data, mutation);
    // first-run onboarding hints: show during the player's first 2 runs ever
    const runs = Number(localStorage.getItem(RUNS_KEY) ?? 0);
    eng.showHints = runs < 2;
    localStorage.setItem(RUNS_KEY, String(runs + 1));
    engineRef.current = eng;
    setHud({ score: 0, combo: 0 });
    setResult(null);
    setRank(null);
    setPhase("running");
    lastRef.current = performance.now();
    accRef.current = 0;
  }, [data, mutation, buildEngine]);

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
          bestStreak: result.bestStreak, mutation: mutation?.id,
          symbol: data.seed.symbol, date: data.seed.date,
        }),
      });
      const j = await res.json();
      if (typeof j.rank === "number") setRank(j.rank);
      const b = await fetch(`/api/leaderboard?date=${data.seed.date}`).then((r) => r.json());
      setBoard(b.entries ?? []);
      setTopBoard(b.entries ?? []);
    } finally {
      setSubmitting(false);
    }
  };

  const downloadCard = async () => {
    if (!result || !data) return;
    const top = topBoard[0];
    const rivalGap = top && top.score > result.score ? top.score - result.score : 0;
    const blob = await makeDeathCard({
      result, symbol: data.seed.symbol, date: data.seed.date, best,
      mutationName: mutation && mutation.id !== "clean" ? mutation.name : undefined,
      rivalName: top && top.score > result.score ? top.name : undefined,
      rivalGap: rivalGap || undefined,
      isTop: !top || top.score <= result.score,
      realMovePct: stats?.changePct,
      difficulty: stats?.difficulty,
    });
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

  const toggleMute = () => {
    const m = !muted;
    setMutedState(m);
    localStorage.setItem(MUTE_KEY, m ? "1" : "0");
    unlockAudio(); // create context first so suspend/resume has a target
    setMuted(m);
  };

  const seedLabel = data ? `${data.seed.symbol} · ${data.seed.date}` : "";
  const stats = useMemo(() => marketStats(data?.candles ?? []), [data]);
  const top = topBoard[0];
  const rivalGap = result && top && top.score > result.score ? top.score - result.score : 0;

  return (
    <div className="cc-root" onContextMenu={(e) => e.preventDefault()}>
      {/* HUD */}
      <div className="cc-hud">
        <div className="cc-hud-left">
          <div className="cc-chip cc-chip-lime">{seedLabel}</div>
          {mutation && mutation.id !== "clean" && phase !== "loading" && (
            <div className="cc-chip cc-chip-mut" title={mutation.tagline}>{mutation.name}</div>
          )}
        </div>
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

        {phase === "ready" && data && mutation && (
          <div className="cc-overlay">
            <div className="cc-panel">
              <h1 className="cc-title">CANDLE<span>CLIMBER</span></h1>
              <p className="cc-tag">the chart is the level</p>
              <div className="cc-daily">
                <span className="cc-daily-label">TODAY&apos;S CHART</span>
                <span className="cc-daily-symbol">{data.seed.symbol}</span>
                <span className="cc-daily-src">{data.seed.source === "binance" ? "live data" : "synthetic"}</span>
              </div>
              {stats && (
                <div className="cc-realmove">
                  <MiniChart candles={data.candles} />
                  <div className="cc-realmove-row">
                    <span>
                      REAL MOVE <b className={stats.changePct >= 0 ? "up" : "down"}>{fmtPct(stats.changePct)}</b>
                    </span>
                    <span className="cc-realmove-sep">·</span>
                    <span>
                      DIFFICULTY <b className={stats.difficulty === "BRUTAL" ? "down" : "up"}>{stats.difficulty}</b>
                    </span>
                  </div>
                </div>
              )}
              <div className="cc-mut-banner" title={mutation.tagline}>
                <span className="cc-mut-label">MUTATION</span>
                <span className={mutation.id === "clean" ? "cc-mut-name" : "cc-mut-name hot"}>{mutation.name}</span>
                <span className="cc-mut-tag">{mutation.tagline}</span>
              </div>
              <div className="cc-howto">
                <p><b className="lime">GREEN</b> candles hold. <b className="coral">RED</b> candles crumble.</p>
                <p>Tap / Space to jump. One chart. Every player. Daily.</p>
                <p className="cc-next-level">Every vibe/vibe launch becomes a future level.</p>
              </div>
              <button className="cc-btn cc-btn-start" onClick={startRun}>START CLIMB</button>
              {best > 0 && <p className="cc-best">PERSONAL BEST <b>{best.toLocaleString()}</b></p>}
              {topBoard.length > 0 && (
                <div className="cc-board cc-board-mini">
                  <div className="cc-board-title">TOP 3 TODAY</div>
                  {topBoard.slice(0, 3).map((e, i) => (
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
              {rivalGap > 0 && top && (
                <p className="cc-rival">
                  TOP TODAY: <b>{top.name}</b> · {top.score.toLocaleString()} — you were <b>{rivalGap.toLocaleString()}</b> pts behind
                </p>
              )}
              {rivalGap === 0 && topBoard.length > 0 && <p className="cc-rival cc-rival-lead">YOU LEAD THE DAILY CHART. FLEX IT.</p>}
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
        onClick={toggleMute}
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? "MUTED" : "SOUND ON"}
      </button>
    </div>
  );
}
