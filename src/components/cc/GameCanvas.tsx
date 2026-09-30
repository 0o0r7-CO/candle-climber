"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Engine, VIEW_W, VIEW_H } from "@/game/cc/engine";
import { buildPlatforms } from "@/game/cc/level";
import { dailyMutation, type Mutation } from "@/game/cc/mutations";
import { marketStats, fmtPct } from "@/game/cc/market";
import { pickSeed, syntheticCandles, LIMIT, ALL_SYMBOLS, INTERVALS, isInterval, type GameInterval } from "@/game/cc/level-source";
import { utcDateStr } from "@/game/cc/rng";
import MiniChart from "@/components/cc/MiniChart";
import ArchiveBrowser from "@/components/cc/ArchiveBrowser";
import { isArchiveDate } from "@/game/cc/archive";
import { render, COLORS } from "@/game/cc/render";
import { renderV2 } from "@/game/cc/render-v2";
import { deriveWeather } from "@/game/cc/weather";
import { recordWreck, wrecksFor, loadWreckDB, saveWreckDB, type WreckDB, type Wreck } from "@/game/cc/wreckage";
import { makeDeathCard, normalizeRivalTag } from "@/game/cc/deathcard";
import { sfx, setMuted, unlockAudio } from "@/game/cc/sound";
import type { CandleData, RunResult } from "@/game/cc/types";

type Phase = "loading" | "ready" | "running" | "graduated" | "dead";
interface BoardEntry {
  name: string;
  score: number;
  candlesPassed: number;
  bestStreak?: number;
  mutation?: string;
  date: string;
  ts?: number;
}
// H4 DAILY REPORT — aggregated over real submissions by /api/report
interface ReportResp {
  date: string;
  symbol: string;
  report: { climbers: number; topScore: number; topName: string; bestStreak: number; medianScore: number; totalHeight: number; topMutation: string | null; topMutationRuns: number } | null;
  narrative: string[];
  tomorrowSymbol: string;
  store: string;
}

const BEST_KEY = "cc_best_v1";
const NAME_KEY = "cc_name_v1";
const RIVAL_KEY = "cc_rival_v1"; // P3.1: remembered rivalry tag
const MUTE_KEY = "cc_mute_v1";
const RUNS_KEY = "cc_runs_v1";
const TF_KEY = "cc_tf_v1"; // P3.5: remembered timeframe ("1w" classic default)
const UNSCORED_MSG = "offline terrain — scoring disabled";
const ARCHIVE_MSG = "practice — archive terrain is unscored";

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const rafRef = useRef<number>(0);
  const lastRef = useRef<number>(0);
  const accRef = useRef<number>(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [data, setData] = useState<CandleData | null>(null);
  const [mutation, setMutation] = useState<Mutation | null>(null);
  // P3.2: mutation id flows into the renderers via ref — the RAF loop must not
  // re-subscribe on mutation change (same pattern as seedRef/wrecksRef)
  const mutationIdRef = useRef<string | undefined>(undefined);
  const [hud, setHud] = useState({ score: 0, combo: 0 });
  const [result, setResult] = useState<RunResult | null>(null);
  const [graduated, setGraduated] = useState(false); // W4: summit reached
  const [world2, setWorld2] = useState(false); // W4: post-grad buyback world
  const [best, setBest] = useState(0);
  const [name, setName] = useState("");
  const [rival, setRival] = useState(""); // P3.1: optional rival X handle for the death-card challenge stamp
  const [board, setBoard] = useState<BoardEntry[]>([]);
  const [topBoard, setTopBoard] = useState<BoardEntry[]>([]);
  const [rank, setRank] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [muted, setMutedState] = useState(false);
  // P2.4: yesterday's episode — honest aggregates over the day's submissions
  const [report, setReport] = useState<ReportResp | null>(null);
  const [reportCopied, setReportCopied] = useState(false);
  const [reportOpen, setReportOpen] = useState(false); // G2 de-clutter: folded by default
  // P2.1: v1/v2 renderer A/B — /?renderer=v2 opts into the grammar+parallax+juice
  // renderer (render-only: physics/scoring/determinism identical). Set client-side
  // in the load effect to avoid SSR hydration mismatch.
  const [v2, setV2] = useState(false);
  // P2.2: H1 ARCHIVE — /?symbol=&date=<past UTC date> plays real history as
  // PRACTICE terrain (submission suppressed; W1 staleness stays authoritative).
  const [archive, setArchive] = useState(false);
  const [archOpen, setArchOpen] = useState(false);
  // P2.5: H3 WRECKAGE — per-device frozen death ghosts (decor only)
  const wreckDBRef = useRef<WreckDB>({});
  const wrecksRef = useRef<Wreck[]>([]);
  const seedRef = useRef<string>("");
  // P3.5: deep-link pins parsed once by the init effect, consumed by the loader
  const requestedSymRef = useRef("");
  const requestedDateRef = useRef<string | null>(null);
  const launchRef = useRef(false);
  const [tf, setTf] = useState<GameInterval>("1w"); // timeframe selector
  const [booted, setBooted] = useState(false); // init ran → loader may fetch

  // init: persisted prefs + deep-link parsing (no fetching here — the loader
  // effect below owns the fetch so a timeframe change re-loads cleanly)
  useEffect(() => {
    setBest(Number(localStorage.getItem(BEST_KEY) ?? 0));
    setName(localStorage.getItem(NAME_KEY) ?? "");
    setRival(localStorage.getItem(RIVAL_KEY) ?? ""); // P3.1
    const savedMute = localStorage.getItem(MUTE_KEY) === "1";
    setMutedState(savedMute);
    if (savedMute) setMuted(true); // applies on next unlock
    // optional deep links (whitelist-checked; the server still pins the terrain
    // and issues the run token): /?symbol=ETHUSDT opens that chart,
    // /?source=launch plays the vibe/vibe launch-of-the-day level,
    // /?date=<past UTC date> plays the archive (H1), and /?interval=1h|4h|1d
    // pins the timeframe (P3.5) — famous history as terrain.
    const params = new URLSearchParams(window.location.search);
    setV2(params.get("renderer") === "v2"); // whitelisted single value
    wreckDBRef.current = loadWreckDB(); // H3: this device's death map
    const requested = (params.get("symbol") ?? "").toUpperCase();
    const requestedDate = params.get("date");
    const isArch = isArchiveDate(requestedDate, utcDateStr());
    setArchive(isArch);
    requestedSymRef.current = ALL_SYMBOLS.includes(requested) ? requested : "";
    requestedDateRef.current = requestedDate;
    launchRef.current = !isArch && params.get("source") === "launch"; // single whitelisted value
    const reqIv = params.get("interval"); // P3.5: deep link beats the saved pref
    if (isInterval(reqIv)) setTf(reqIv);
    else if (isInterval(localStorage.getItem(TF_KEY))) setTf(localStorage.getItem(TF_KEY) as GameInterval);
    setBooted(true);
  }, []);

  // level loader — re-runs on timeframe change (P3.5): same pipeline, seed keys
  // carry the interval server-side; archive stays daily-only ("1w") in V1.
  useEffect(() => {
    if (!booted) return;
    let alive = true;
    setPhase("loading");
    // a timeframe switch invalidates any run state from the previous terrain
    setResult(null);
    setRank(null);
    setGraduated(false);
    setWorld2(false);
    const isArch = archive;
    const query = new URLSearchParams();
    if (requestedSymRef.current) query.set("symbol", requestedSymRef.current);
    if (isArch && requestedDateRef.current) query.set("date", requestedDateRef.current); // server re-validates (past dates only)
    if (launchRef.current) query.set("source", "launch");
    if (!isArch) query.set("interval", tf);
    const qs = query.toString();
    fetch(`/api/candles${qs ? `?${qs}` : ""}`)
      .then((r) => r.json())
      .then((d: CandleData) => {
        if (!alive) return;
        seedRef.current = d.seed.date + d.seed.symbol;
        wrecksRef.current = wrecksFor(wreckDBRef.current, seedRef.current);
        setData(d);
        setMutation(dailyMutation(d.seed.date + d.seed.symbol));
        setPhase("ready");
        if (!isArch) {
          fetch(`/api/leaderboard?date=${d.seed.date}&interval=${tf}`)
            .then((r) => r.json())
            .then((b) => { if (alive) setTopBoard(b.entries ?? []); })
            .catch(() => {});
          // H4: yesterday's episode for the ready screen (cliffhanger loop)
          fetch("/api/report")
            .then((r) => r.json())
            .then((rp: ReportResp) => { if (alive) setReport(rp); })
            .catch(() => {});
        }
      })
      .catch(() => {
        if (!alive) return;
        // API unreachable — derive the SAME level client-side from the
        // shared seed (identical to what the server would serve; play never
        // crashes). Archive deep links keep their date; terrain is synthetic
        // (tokenless → unscored) until the API returns.
        const date = isArch ? (requestedDateRef.current as string) : utcDateStr();
        const symbol = requestedSymRef.current || pickSeed(date).symbol;
        const iv: GameInterval = isArch ? "1w" : tf;
        const d: CandleData = {
          seed: { date, symbol, interval: iv, source: "synthetic" },
          candles: syntheticCandles(date, LIMIT, iv),
        };
        seedRef.current = d.seed.date + d.seed.symbol;
        wrecksRef.current = wrecksFor(wreckDBRef.current, seedRef.current);
        setData(d);
        setMutation(dailyMutation(d.seed.date + d.seed.symbol));
        setPhase("ready");
      });
    return () => { alive = false; };
  }, [tf, archive, booted]);

  // P3.5: timeframe switch — persist and let the loader effect re-fetch
  const changeTf = useCallback((iv: GameInterval) => {
    setTf((cur) => {
      if (iv !== cur) localStorage.setItem(TF_KEY, iv);
      return iv;
    });
  }, []);

  const buildEngine = useCallback((d: CandleData, mut: Mutation) => {
    const plats = buildPlatforms(d.candles, d.seed.date + d.seed.symbol);
    return new Engine(
      plats,
      {
        onScore: (score, combo) => setHud({ score, combo }),
        onSfx: (s) => sfx[s](),
        onGraduate: () => {
          // W4: summit reached — pause for the celebration panel; the run is
          // still live (score snapshot now, real RunResult only at death).
          const eng = engineRef.current;
          if (!eng) return;
          setGraduated(true);
          setResult({
            score: Math.floor(eng.score),
            candlesPassed: eng.candlesPassed,
            bestStreak: eng.bestStreak,
            candleIndex: eng.candlesPassed,
            graduated: true,
            world2: eng.world2,
          });
          setHud({ score: Math.floor(eng.score), combo: 0 });
          setPhase("graduated");
        },
        onDeath: (r) => {
          sfx.death();
          // H3 WRECKAGE: freeze this death into the device's local map —
          // the exact fall point, visible to future climbers of this level
          const eng = engineRef.current;
          if (eng) {
            const wreck: Wreck = {
              x: eng.px + 17,
              y: eng.py + 20,
              cause: r.cause ?? "fell",
              ts: Date.now(),
            };
            wreckDBRef.current = recordWreck(wreckDBRef.current, seedRef.current, wreck);
            saveWreckDB(wreckDBRef.current);
            wrecksRef.current = wrecksFor(wreckDBRef.current, seedRef.current);
          }
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
      d.seed.date + d.seed.symbol, // W4: world-2 sky seed (same string as the level)
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
    setGraduated(false);
    setWorld2(false);
    setPhase("running");
    lastRef.current = performance.now();
    accRef.current = 0;
  }, [data, mutation, buildEngine]);

  // W4: from the GRADUATED panel, continue into the post-graduation buyback
  // world — doubled gains, endless procedural sky. The run keeps its score.
  const enterWorld2 = useCallback(() => {
    const eng = engineRef.current;
    if (!eng || !eng.graduated || eng.world2) return;
    eng.enterWorld2();
    setWorld2(true);
    setPhase("running");
    lastRef.current = performance.now();
    accRef.current = 0;
  }, []);

  // P2.3 (H2): weather is derived from the SAME closed candles that shaped the
  // terrain — pure, deterministic, render-only. Consumed by renderV2 (wind
  // sway/streaks, volume fog, tremor) and surfaced in the HUD when it matters.
  const weather = useMemo(
    () => (data ? deriveWeather(data.candles, data.seed.date + data.seed.symbol) : null),
    [data],
  );

  // main loop
  useEffect(() => {
    if (phase !== "running" && phase !== "dead" && phase !== "graduated") return;
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
        // "graduated" pauses the simulation while the celebration panel is up
        if (phase === "running" || phase === "dead") e.step(FIXED);
        accRef.current -= FIXED;
      }
      ctx.clearRect(0, 0, VIEW_W, VIEW_H);
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      if (v2) renderV2(ctx, e, seedRef.current, weather ?? undefined, wrecksRef.current, mutationIdRef.current);
      else render(ctx, e, seedRef.current, mutationIdRef.current);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [phase, v2, weather]);

  // P3.2: mirror mutation state → ref consumed by the RAF render loop
  useEffect(() => {
    mutationIdRef.current = mutation?.id;
  }, [mutation]);

  // input
  useEffect(() => {
    const down = (ev: KeyboardEvent) => {
      if (ev.repeat) return;
      // G2 owner note: typing a name must never jump or restart the run
      const tag = (ev.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (ev.code === "Space" || ev.code === "ArrowUp" || ev.code === "KeyW") {
        ev.preventDefault();
        if (phase === "ready" || phase === "dead") startRun();
        else if (phase === "graduated") {
          // Space on the graduated panel = enter world 2 (tap-to-continue parity);
          // let focused buttons/inputs handle Space themselves.
          const tag = (ev.target as HTMLElement | null)?.tagName;
          if (tag === "BUTTON" || tag === "INPUT") return;
          enterWorld2();
        }
        else engineRef.current?.press();
      }
    };
    const up = (ev: KeyboardEvent) => {
      if (ev.code === "Space" || ev.code === "ArrowUp" || ev.code === "KeyW") engineRef.current?.release();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [phase, startRun, enterWorld2]);

  const onPointerDown = (ev: React.PointerEvent) => {
    // G2 owner note: the death/ready panels live inside the stage — never hijack
    // clicks meant for the name input or any other control inside them
    if ((ev.target as HTMLElement | null)?.closest("input,button,a,select,textarea,label")) return;
    ev.preventDefault();
    if (phase === "ready") { startRun(); return; }
    engineRef.current?.press();
  };
  const onPointerUp = () => engineRef.current?.release();

  const submitScore = async () => {
    // tokenless terrain (synthetic fallback) is unscored — never POST it
    if (!result || !data || submitting || !data.runToken) return;
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
          runToken: data.runToken,
        }),
      });
      const j = await res.json();
      if (typeof j.rank === "number") setRank(j.rank);
      const b = await fetch(`/api/leaderboard?date=${data.seed.date}&interval=${tf}`).then((r) => r.json());
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
    // P3.1: honor the typed rival handle — invalid input simply omits the stamp
    const challenge = normalizeRivalTag(rival);
    if (rival.trim()) localStorage.setItem(RIVAL_KEY, rival.trim());
    const blob = await makeDeathCard({
      result, symbol: data.seed.symbol, date: data.seed.date, best,
      mutationName: mutation && mutation.id !== "clean" ? mutation.name : undefined,
      rivalName: top && top.score > result.score ? top.name : undefined,
      rivalGap: rivalGap || undefined,
      isTop: !top || top.score <= result.score,
      realMovePct: stats?.changePct,
      difficulty: stats?.difficulty,
      rivalTag: challenge ?? undefined,
      interval: data.seed.interval,
    });
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `candle-climber-${result.score}.png`;
    a.click();
    URL.revokeObjectURL(url);
    // P3.1: the mockery loop — share text tags the rival so their audience sees it
    const shareText = challenge
      ? `${challenge} you're up — beat ${result.score} on today's ${data.seed.symbol} chart`
      : "Candle Climber";
    if (navigator.share && navigator.canShare?.({ files: [new File([blob], "card.png", { type: "image/png" })] })) {
      try {
        await navigator.share({ files: [new File([blob], "card.png", { type: "image/png" })], title: shareText });
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

  // H4: the report is designed to travel — copy the episode verbatim
  const copyReport = () => {
    if (!report) return;
    const text = `CANDLE CLIMBER — DAILY REPORT ${report.date}\n${report.narrative.join("\n")}\nhttps://candle-climber.vercel.app`;
    navigator.clipboard?.writeText(text).then(() => {
      setReportCopied(true);
      setTimeout(() => setReportCopied(false), 1600);
    }).catch(() => {});
  };

  const seedLabel = data ? `${data.seed.symbol} · ${data.seed.date}` : "";
  const stats = useMemo(() => marketStats(data?.candles ?? []), [data]);
  const weatherChip = v2 && weather && (weather.wind >= 0.15 || weather.fog >= 0.3)
    ? `${weather.windLabel} · ${weather.fogLabel}`
    : null;
  const canSubmit = Boolean(data?.runToken) && !archive; // archive = practice (H1)
  const unscoredMsg = archive ? ARCHIVE_MSG : UNSCORED_MSG;
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
          {graduated && <div className="cc-chip cc-chip-grad">GRADUATED</div>}
          {world2 && <div className="cc-chip cc-chip-grad2">POST-GRAD ×2</div>}
          {v2 && <div className="cc-chip cc-chip-mut" title="renderer v2 — grammar + parallax + juice">RENDER V2</div>}
          {weatherChip && <div className="cc-chip cc-chip-weather" title="H2 weather — ATR wind · volume fog">{weatherChip}</div>}
          {archive && <div className="cc-chip cc-chip-arch" title="archive terrain — practice only">ARCHIVE</div>}
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
                <span className="cc-daily-label" title={archive ? "Real history — practice terrain" : "Levels reset at 00:00 UTC"}>{archive ? "ARCHIVE CHART · PRACTICE" : "TODAY&apos;S CHART · UTC"}</span>
                <span className="cc-daily-symbol">{data.seed.symbol}</span>
                <span className="cc-daily-src">{data.seed.source === "binance" || data.seed.source === "stooq" ? "live data" : data.seed.source === "vibe-launch" ? "vibe launch" : "synthetic"}</span>
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
                <p>Tap = hop · <b className="lime">HOLD</b> Space = higher jump · release early = short.</p>
                {archive ? (
                  <p className="cc-next-level">famous days are famous difficulty — nobody designed this on purpose.</p>
                ) : (
                  <p className="cc-next-level">One chart. Every player. Daily.</p>
                )}
              </div>
              {/* P3.5 timeframe selector — owner proposal. Crypto dailies only:
                  stock rails have no intraday feed, launch terrain is derived,
                  archive stays weekly (V1) — all three hide the chips. */}
              {!archive && data.seed.source !== "stooq" && data.seed.source !== "vibe-launch" && (
                <div className="cc-tf-row" role="group" aria-label="Chart timeframe">
                  {INTERVALS.map((iv) => (
                    <button
                      key={iv}
                      className={`cc-tf-chip${tf === iv ? " cc-tf-on" : ""}`}
                      onClick={() => changeTf(iv)}
                      aria-pressed={tf === iv}
                    >
                      {iv.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
              <div className="cc-btn-row">
                <button className="cc-btn cc-btn-start" onClick={startRun}>START CLIMB</button>
                <button className="cc-btn cc-btn-ghost" onClick={() => setArchOpen(true)}>ARCHIVE →</button>
              </div>
              {best > 0 && <p className="cc-best">PERSONAL BEST <b>{best.toLocaleString()}</b></p>}
              {!archive && report && (
                <div className="cc-report cc-report-fold">
                  <button
                    className="cc-report-toggle"
                    onClick={() => setReportOpen((o) => !o)}
                    aria-expanded={reportOpen}
                  >
                    <span className="cc-report-arrow" aria-hidden>{reportOpen ? "▾" : "▸"}</span>
                    DAILY REPORT · {report.date} · {report.symbol}
                  </button>
                  {reportOpen && (
                    <>
                      {report.narrative.map((line, i) => (
                        <p key={i} className="cc-report-line">{line}</p>
                      ))}
                      <button className="cc-report-copy" onClick={copyReport}>{reportCopied ? "COPIED ✓" : "COPY EPISODE"}</button>
                    </>
                  )}
                </div>
              )}
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

        {phase === "graduated" && result && (
          <div className="cc-overlay">
            <div className="cc-panel cc-panel-death">
              <h2 className="cc-grad-headline">GRADUATED</h2>
              <p className="cc-grad-flavor">curve summit reached · graduation: 5 eth class</p>
              <div className="cc-death-score">
                <span className="cc-death-num">{result.score.toLocaleString()}</span>
                <span className="cc-death-sub">
                  {result.candlesPassed} candles · best streak x{result.bestStreak} · PB {best.toLocaleString()}
                </span>
              </div>
              <div className="cc-death-actions">
                <button className="cc-btn cc-btn-start" onClick={enterWorld2}>WORLD 2 →</button>
                <button className="cc-btn cc-btn-ghost" onClick={downloadCard}>DEATH CARD ↓</button>
                <button
                  className="cc-btn"
                  onClick={submitScore}
                  disabled={submitting || !canSubmit}
                  title={canSubmit ? undefined : unscoredMsg}
                >
                  {submitting ? "…" : "SUBMIT SCORE"}
                  {!canSubmit && <span className="sr-only">{unscoredMsg}</span>}
                </button>
                <button className="cc-btn" onClick={startRun}>RETRY</button>
              </div>
              <p className="cc-grad-next">world 2: the climb continues · gains ×2</p>
              {rank !== null && <p className="cc-rank">GLOBAL RANK #{rank} TODAY</p>}
            </div>
          </div>
        )}

        {phase === "dead" && result && (
          <div className="cc-overlay">
            <div className="cc-panel cc-panel-death">
              <h2 className="cc-liquidated">LIQUIDATED</h2>
              {result.graduated && (
                <p className="cc-rival cc-rival-grad">
                  graduated{result.world2 ? " · world 2 reached" : ""}
                </p>
              )}
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
                <input
                  className="cc-input cc-input-rival"
                  placeholder="RIVAL @HANDLE (OPTIONAL)"
                  maxLength={16}
                  value={rival}
                  onChange={(e) => setRival(e.target.value)}
                  aria-label="Rival X handle — stamped on the death card as a challenge"
                />
                <button
                  className="cc-btn"
                  onClick={submitScore}
                  disabled={submitting || !canSubmit}
                  title={canSubmit ? undefined : unscoredMsg}
                >
                  {submitting ? "…" : "SUBMIT SCORE"}
                  {!canSubmit && <span className="sr-only">{unscoredMsg}</span>}
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

      {archOpen && <ArchiveBrowser onClose={() => setArchOpen(false)} />}

      <footer className="cc-footer">
        <a href="https://testnet.vibevibe.fun/" target="_blank" rel="noopener noreferrer">vibe/vibe testnet</a>
        <span aria-hidden>·</span>
        <a href="https://faucet.testnet.chain.robinhood.com/" target="_blank" rel="noopener noreferrer">faucet</a>
        <span aria-hidden>·</span>
        <a href="https://discord.gg/vibevibebuilders" target="_blank" rel="noopener noreferrer">discord</a>
        <span aria-hidden>·</span>
        <span>no real funds</span>
      </footer>

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
