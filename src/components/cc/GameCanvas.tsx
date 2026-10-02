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
import { rosterList, isValidCharId, DEFAULT_CHAR_ID, CHAR_KEY, getChar } from "@/game/cc/characters";
import { sfx, setMuted, unlockAudio } from "@/game/cc/sound";
import { RivalBot, pickRivalCharId, rivalVerdict } from "@/game/cc/rival/bot";
import { personalityForCharId } from "@/game/cc/rival/personality";
// P7.2 ghost runs — position-stream recorder + replay (cosmetic, never scored)
import { GhostRecorder, ghostViewAt, bestGhost, type GhostEntry, type GhostView } from "@/game/cc/ghost";
// P7.3 async duels — a challenge code pins the SAME terrain and races the
// recorded climb; verdict + tally are local/social (W5 untouched)
import {
  DUEL_CODE_RE, EMPTY_TALLY, applyDuelResult, challengeToGhost, duelUrl,
  duelVerdict, parseTally, tallyLabel,
  type DuelChallenge, type DuelTally,
} from "@/game/cc/duel";
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
const VS_KEY = "cc_vsbot_v1"; // P7.1: remembered SOLO / VS BOT choice (default SOLO)
const GHOST_KEY = "cc_ghost_v1"; // P7.2: remembered ghost replay toggle (default ON)
const DUEL_TALLY_KEY = "cc_duel_v1"; // P7.3: local duel W-L-D tally (no server identity exists)
const CC_CHAR_KEY = CHAR_KEY; // P3.12: remembered character id ("default" = procedural)
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
  const [hud, setHud] = useState({ score: 0, combo: 0, candles: 0 });
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
  // P3.12: selected character — ref feeds the RAF renderer without re-subscribing
  const [charId, setCharId] = useState<string>(DEFAULT_CHAR_ID);
  const charIdRef = useRef<string>(DEFAULT_CHAR_ID);
  // P7.1: rival bot — local headless engine + heuristic planner; zero network,
  // its score/height are local UI only (W5 anti-cheat red line: never submitted)
  const [vsBot, setVsBot] = useState(false);
  const vsBotRef = useRef(false); // RAF loop reads the ref (no re-subscribe)
  const botRef = useRef<RivalBot | null>(null);
  const [verdict, setVerdict] = useState<string | null>(null);

  // P7.2: ghost replay — the best submitted run on THIS terrain, replayed as a
  // translucent climber. Recorder is honest-local; the ghost POST rides the
  // SAME verified run-token as the leaderboard (server pins terrain from it).
  // Cosmetic contract: ghosts never affect scores/ranks (W5 untouched).
  const [ghostOn, setGhostOn] = useState(true);
  const ghostOnRef = useRef(true); // RAF loop reads the ref (no re-subscribe)
  const ghostRef = useRef<GhostEntry | null>(null); // RAF loop reads the ref
  const [ghostEntry, setGhostEntry] = useState<GhostEntry | null>(null); // UI mirror (refs don't re-render)
  const ghostRecRef = useRef<GhostRecorder>(new GhostRecorder());

  // P7.3: async duel — the loaded challenge (target + replayable climb), the
  // local W-L-D tally, and the code created from THIS device's last run.
  const [duel, setDuel] = useState<DuelChallenge | null>(null);
  const duelRef = useRef<DuelChallenge | null>(null); // death/grad handlers read the ref
  const duelLockRef = useRef(false); // once a duel loads it owns the ghost replay slot
  const [duelTally, setDuelTally] = useState<DuelTally>(EMPTY_TALLY);
  const [duelCode, setDuelCode] = useState<string | null>(null); // challenge created from this run
  const [duelBusy, setDuelBusy] = useState(false);
  const [duelCopied, setDuelCopied] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false); // code entry reveal (collapsed = zero clutter)
  const [codeInput, setCodeInput] = useState("");
  const [codeErr, setCodeErr] = useState(false);

  // P7.3: load a duel challenge by code (deep link ?duel= or a typed code).
  // On success it pins the terrain refs BEFORE the loader effect runs (the
  // deep-link path holds `booted` until this settles → exactly one fetch).
  const loadDuel = useCallback(async (rawCode: string): Promise<boolean> => {
    const code = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    if (!DUEL_CODE_RE.test(code)) return false;
    try {
      const res = await fetch(`/api/duels?code=${code}`);
      const j = (await res.json()) as { duel?: DuelChallenge | null };
      const ch = j.duel ?? null;
      // whitelist the challenge shape client-side too — a poisoned record can
      // never pin the loader at a bogus terrain
      if (!ch || !ALL_SYMBOLS.includes(ch.symbol) || !/^\d{4}-\d{2}-\d{2}$/.test(ch.date) || !isInterval(ch.interval)) {
        return false;
      }
      duelLockRef.current = true; // the duel owns the ghost replay slot
      duelRef.current = ch;
      ghostRef.current = challengeToGhost(ch); // replay the climb you must beat
      requestedSymRef.current = ch.symbol;
      requestedDateRef.current = ch.date;
      // past terrain = practice duel (W1 staleness stays authoritative: the
      // archive run itself stays unscored, the duel verdict stays local)
      setArchive(isArchiveDate(ch.date, utcDateStr()));
      setTf(ch.interval);
      setDuel(ch);
      return true;
    } catch {
      return false;
    }
  }, []);

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
    // P3.12: character — localStorage first, deep-link ?char= wins (same pattern as ?interval=)
    const savedChar = localStorage.getItem(CC_CHAR_KEY) ?? DEFAULT_CHAR_ID;
    const urlChar = new URLSearchParams(window.location.search).get("char");
    const picked = isValidCharId(urlChar) ? (urlChar as string) : isValidCharId(savedChar) ? savedChar : DEFAULT_CHAR_ID;
    setCharId(picked);
    charIdRef.current = picked;
    // P7.1: default SOLO — every existing flow is untouched unless opted in
    const savedVs = localStorage.getItem(VS_KEY) === "1";
    setVsBot(savedVs);
    vsBotRef.current = savedVs;
    // P7.2: ghost replay defaults ON (cosmetic); the opt-out persists
    const savedGhost = localStorage.getItem(GHOST_KEY) !== "0";
    setGhostOn(savedGhost);
    ghostOnRef.current = savedGhost;
    // P7.3: local duel tally (no server identity — the record lives here)
    setDuelTally(parseTally(localStorage.getItem(DUEL_TALLY_KEY)));
    // P7.3: ?duel=CODE deep link — hold the loader until the duel resolves so
    // the terrain fetches exactly once (the duel's terrain, not the default).
    const duelParam = (params.get("duel") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    if (DUEL_CODE_RE.test(duelParam)) {
      void loadDuel(duelParam).finally(() => setBooted(true));
    } else {
      setBooted(true);
    }
  }, [loadDuel]);

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
    ghostRef.current = null; // terrain switch invalidates the previous ghost
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
          // P7.2: best submitted ghost for THIS terrain (champion first)
          fetch(`/api/ghosts?symbol=${d.seed.symbol}&date=${d.seed.date}&interval=${tf}`)
            .then((r) => r.json())
            .then((g: { ghosts?: GhostEntry[] }) => {
              if (!alive || duelLockRef.current) return; // P7.3: a loaded duel owns the ghost slot
              const best = bestGhost(g.ghosts ?? []);
              ghostRef.current = best;
              setGhostEntry(best);
            })
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

  // P3.12: character pick — persists + updates the renderer ref immediately
  const pickChar = useCallback((id: string) => {
    if (!isValidCharId(id)) return;
    setCharId(id);
    charIdRef.current = id;
    try { localStorage.setItem(CC_CHAR_KEY, id); } catch { /* private mode — cosmetic only */ }
    sfx.land();
  }, []);

  // P7.2: ghost replay toggle — persists (GHOST_KEY); default ON. Replay is
  // render-only: no engine reads beyond the ghost's own recorded stream.
  const changeGhost = useCallback((on: boolean) => {
    setGhostOn(on);
    ghostOnRef.current = on;
    try { localStorage.setItem(GHOST_KEY, on ? "1" : "0"); } catch { /* private mode — cosmetic only */ }
  }, []);

  // P7.1: SOLO / VS BOT toggle — persists (VS_KEY); default SOLO keeps every
  // existing QA/leaderboard/anti-cheat flow byte-identical.
  const changeVsBot = useCallback((on: boolean) => {
    setVsBot(on);
    vsBotRef.current = on;
    try { localStorage.setItem(VS_KEY, on ? "1" : "0"); } catch { /* private mode — cosmetic only */ }
    sfx.land();
  }, []);

  // P7.1: the rival's skin/personality is deterministic per level seed — the
  // same daily chart pits every player against the same-flavored ghost
  const rivalCharId = useMemo(
    () => (data ? pickRivalCharId(seedRef.current) : "wickvenom"),
    [data],
  );
  const rivalPers = useMemo(() => personalityForCharId(rivalCharId), [rivalCharId]);
  const rivalName = getChar(rivalCharId).name;

  const buildEngine = useCallback((d: CandleData, mut: Mutation) => {
    const plats = buildPlatforms(d.candles, d.seed.date + d.seed.symbol);
    return new Engine(
      plats,
      {
        onScore: (score, combo) => setHud({ score, combo, candles: engineRef.current?.candlesPassed ?? 0 }),
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
          setHud({ score: Math.floor(eng.score), combo: 0, candles: eng.candlesPassed });
          // P7.1: local verdict at the summit (rival is frozen while panels are up).
          // P7.3: a loaded duel outranks the bot in the verdict line (display
          // only — the tally folds once, at death, since world 2 can still
          // improve the run).
          const botGrad = botRef.current;
          const duelGrad = duelRef.current;
          if (duelGrad) {
            setVerdict(duelVerdict(duelGrad, { score: Math.floor(eng.score), candlesPassed: eng.candlesPassed }).line);
          } else if (vsBotRef.current && botGrad) {
            setVerdict(rivalVerdict(eng.candlesPassed, botGrad.bestCandles).line);
          }
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
          ghostRecRef.current.stop(); // P7.2: stream ends at the death tick
          setHud({ score: r.score, combo: 0, candles: r.candlesPassed });
          // P7.1: local verdict at death — purely client-side, never submitted.
          // P7.3: the duel verdict is final here; the local W-L-D tally folds once.
          const bot = botRef.current;
          const dc = duelRef.current;
          if (dc) {
            const v = duelVerdict(dc, { score: r.score, candlesPassed: r.candlesPassed });
            setVerdict(v.line);
            setDuelTally((t) => {
              const nt = applyDuelResult(t, v.outcome);
              try { localStorage.setItem(DUEL_TALLY_KEY, JSON.stringify(nt)); } catch { /* private mode */ }
              return nt;
            });
          } else if (vsBotRef.current && bot) {
            setVerdict(rivalVerdict(r.candlesPassed, bot.bestCandles).line);
          }
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
    // P7.1: a fresh rival per run — same candles + same seed ⇒ the SAME
    // deterministic level build (reused, never forked); the bot restarts
    // with a fresh personality-consistent plan on every human retry.
    botRef.current = vsBotRef.current
      ? new RivalBot(data.candles, seedRef.current, rivalCharId, mutation.mods)
      : null;
    setVerdict(null);
    // P7.2: record THIS run's position stream (stopped at death; flushed at submit)
    ghostRecRef.current.start();
    // P7.3: while a duel is loaded, its challenge owns the replay slot —
    // every retry re-pins the challenger's climb (terrain ghosts stand down)
    if (duelRef.current) ghostRef.current = challengeToGhost(duelRef.current);
    setHud({ score: 0, combo: 0, candles: 0 });
    setResult(null);
    setRank(null);
    setGraduated(false);
    setWorld2(false);
    setPhase("running");
    lastRef.current = performance.now();
    accRef.current = 0;
  }, [data, mutation, buildEngine, rivalCharId]);

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
        // P7.1: the rival steps on the SAME fixed-timestep clock inside this
        // SAME RAF loop (never a second loop). Frozen while any panel is up,
        // so the verdict numbers freeze with the human's run.
        if (phase === "running" && vsBotRef.current) botRef.current?.tick(FIXED);
        // P7.2: recorder samples every 2nd fixed tick (30 Hz) while the run is live
        if (phase === "running") ghostRecRef.current.tick(e.px, e.py);
        accRef.current -= FIXED;
      }
      ctx.clearRect(0, 0, VIEW_W, VIEW_H);
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      const bot = vsBotRef.current ? botRef.current : null;
      // P7.2: ghost replay — position lookup by the human engine's own clock
      const gv: GhostView | null =
        ghostOnRef.current && ghostRef.current && (phase === "running" || phase === "dead" || phase === "graduated")
          ? ghostViewAt(ghostRef.current, e.time)
          : null;
      if (v2) renderV2(ctx, e, seedRef.current, weather ?? undefined, wrecksRef.current, mutationIdRef.current, charIdRef.current, bot, gv);
      else render(ctx, e, seedRef.current, mutationIdRef.current, bot, gv);
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
      // P3.6 RUSH (desktop): hold Shift = faster climb + 25% gains (opt-in risk)
      if (ev.key === "Shift") {
        engineRef.current?.pressRush();
        return;
      }
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
      // release rush unconditionally — even after alt-tab or input focus changes
      if (ev.key === "Shift") engineRef.current?.releaseRush();
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
      // P7.2: submit the run's ghost with the SAME verified run-token
      // (best-effort — a ghost failure must never fail the score submission;
      // the ghost is cosmetic and the next load simply replays nothing).
      const samples = ghostRecRef.current.flush();
      if (samples.length > 0) {
        fetch("/api/ghosts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            runToken: data.runToken, name: finalName, charId: charIdRef.current,
            candlesPassed: result.candlesPassed, samples,
          }),
        })
          .then((r) => { if (r.ok) return r.json(); throw new Error("ghost rejected"); })
          .then(() => fetch(`/api/ghosts?symbol=${data.seed.symbol}&date=${data.seed.date}&interval=${tf}`))
          .then((r) => r.json())
          .then((g: { ghosts?: GhostEntry[] }) => {
            const best = bestGhost(g.ghosts ?? []);
            ghostRef.current = best;
            setGhostEntry(best);
          })
          .catch(() => {});
      }
    } catch {
      // Same incident class as CANDLE-CLIMBER-2 (unhandled rejection): a failed
      // POST / JSON parse must not escape as an unhandled promise rejection.
      // Score stays in local best; the panel keeps working for another try.
    } finally {
      setSubmitting(false);
    }
  };

  // P7.3: turn THIS completed run into an async duel — the code IS the
  // invitation (?duel=CODE). The share text rides the P3.1 rivalry tag when
  // one is typed, so the mockery loop and the duel loop are the same loop.
  const createDuel = async () => {
    if (!result || !data || !data.runToken || duelBusy || duelCode) return;
    setDuelBusy(true);
    try {
      const finalName = (name.trim() || "ANON").slice(0, 14);
      const res = await fetch("/api/duels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runToken: data.runToken, name: finalName, charId: charIdRef.current,
          score: result.score, candlesPassed: result.candlesPassed,
          bestStreak: result.bestStreak, samples: ghostRecRef.current.flush(),
        }),
      });
      const j = (await res.json()) as { ok?: boolean; code?: string };
      if (res.ok && j.ok && j.code) {
        setDuelCode(j.code);
        const tag = normalizeRivalTag(rival);
        if (rival.trim()) localStorage.setItem(RIVAL_KEY, rival.trim());
        const link = duelUrl(window.location.origin, j.code);
        const text = tag
          ? `${tag} you're up — beat ${result.score} on today's ${data.seed.symbol} chart: ${link}`
          : `beat my ${result.score} on today's ${data.seed.symbol} chart: ${link}`;
        try {
          await navigator.clipboard.writeText(text);
          setDuelCopied(true);
          setTimeout(() => setDuelCopied(false), 1600);
        } catch { /* clipboard denied — the code still shows for manual share */ }
      }
    } catch {
      // honest failure: the button stays available for another try
    } finally {
      setDuelBusy(false);
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
      duelCode: duelCode ?? undefined, // P7.3: the card doubles as the invitation
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
          {/* P7.1: live rival race — local-only numbers, never submitted */}
          {vsBot && botRef.current && !botRef.current.stopped && (
            <div className="cc-chip cc-chip-rival" title="rival bot — local simulation, never scored">
              RIVAL {botRef.current.candles} / YOU {hud.candles}
            </div>
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
                <span className="cc-daily-label" title={archive ? "Real history — practice terrain" : "Levels reset at 00:00 UTC"}>{archive ? "ARCHIVE CHART · PRACTICE" : "TODAY'S CHART · UTC"}</span>
                <span className="cc-daily-symbol">{data.seed.symbol}</span>
                <span className="cc-daily-src">{data.seed.source === "binance" || data.seed.source === "stooq" || data.seed.source === "yahoo" ? "live data" : data.seed.source === "vibe-launch" ? "vibe launch" : "synthetic"}</span>
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
                <p><b className="lime">SHIFT</b> = RUSH — faster climb, +25% gains while held.</p>
                {archive ? (
                  <p className="cc-next-level">famous days are famous difficulty — nobody designed this on purpose.</p>
                ) : (
                  <p className="cc-next-level">One chart. Every player. Daily.</p>
                )}
              </div>
              {/* P3.5 timeframe selector — owner proposal. Crypto dailies only:
                  stock rails have no intraday feed, launch terrain is derived,
                  archive stays weekly (V1) — all three hide the chips. */}
              {!archive && !duel && data.seed.source !== "stooq" && data.seed.source !== "yahoo" && data.seed.source !== "vibe-launch" && (
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
              {/* P7.1 rival bot — local SOLO/VS toggle. Default SOLO: existing
                  behavior + QA flows are 100% unchanged; choice persists. The
                  rival is a local headless engine — zero network, never scored. */}
              <div className="cc-tf-row" role="group" aria-label="Rival bot">
                <button
                  className={`cc-tf-chip${!vsBot ? " cc-tf-on" : ""}`}
                  onClick={() => changeVsBot(false)}
                  aria-pressed={!vsBot}
                >
                  SOLO
                </button>
                <button
                  className={`cc-tf-chip${vsBot ? " cc-tf-on" : ""}`}
                  onClick={() => changeVsBot(true)}
                  aria-pressed={vsBot}
                >
                  VS BOT
                </button>
              </div>
              {vsBot && (
                <p className="cc-vs-note" aria-live="polite">
                  RIVAL: <b>{rivalName}</b> · {rivalPers.label} — local bot, never scored
                </p>
              )}
              {/* P7.2 ghost replay — best submitted run on this terrain, replayed
                  translucently with the recorded climber's skin. Render-only. */}
              <div className="cc-tf-row" role="group" aria-label="Ghost replay">
                <button
                  className={`cc-tf-chip${ghostOn ? " cc-tf-on" : ""}`}
                  onClick={() => changeGhost(!ghostOn)}
                  aria-pressed={ghostOn}
                >
                  {ghostOn ? "GHOST ON" : "GHOST OFF"}
                </button>
              </div>
              {ghostOn && !archive && (
                <p className="cc-vs-note" aria-live="polite">
                  GHOST: {duel
                    ? `${duel.name}'s run · ${duel.candlesPassed} candles — the climb to beat`
                    : ghostEntry ? `${getChar(ghostEntry.charId).name} · ${ghostEntry.candlesPassed} candles` : "no run recorded yet — be the first"}
                </p>
              )}
              {/* P7.3 async duel — invitation banner (deep link / typed code) */}
              {duel && (
                <div className="cc-duel-banner" role="status">
                  <span className="cc-duel-head">DUEL · {duel.name} SET THE BAR</span>
                  <span className="cc-duel-target">BEAT <b>{duel.score.toLocaleString()}</b> PTS · {duel.candlesPassed} CANDLES</span>
                  <span className="cc-duel-note">same chart · {duel.date === utcDateStr() ? "live terrain" : "archive terrain — practice duel"} · record {tallyLabel(duelTally)}</span>
                </div>
              )}
              {!duel && !archive && (
                <div className="cc-tf-row">
                  {codeOpen ? (
                    <div className="cc-duel-code-row">
                      <input
                        className={`cc-input cc-input-code${codeErr ? " cc-input-err" : ""}`}
                        placeholder="CODE"
                        maxLength={6}
                        value={codeInput}
                        aria-label="Duel code"
                        onChange={(e) => { setCodeInput(e.target.value.toUpperCase()); setCodeErr(false); }}
                      />
                      <button
                        className="cc-tf-chip"
                        onClick={() => { void loadDuel(codeInput).then((ok) => { if (!ok) setCodeErr(true); }); }}
                      >
                        RACE
                      </button>
                    </div>
                  ) : (
                    <button className="cc-tf-chip" onClick={() => setCodeOpen(true)}>GOT A DUEL CODE?</button>
                  )}
                </div>
              )}
              {codeErr && <p className="cc-vs-note" aria-live="polite">NO SUCH DUEL — CHECK THE CODE</p>}
              {/* P3.12 character select — roster row on the ready flow.
                  Portraits are the sprites' own frame0; selection persists
                  (CC_CHAR_KEY) and feeds renderV2 via charIdRef. Decor-only:
                  no gameplay/physics reads anywhere in the pipeline. */}
              <div className="cc-char-block">
                <div className="cc-char-label">CHOOSE YOUR CLIMBER</div>
                <div className="cc-char-row" role="radiogroup" aria-label="Character select">
                  {rosterList().map((c) => (
                    <button
                      key={c.id}
                      role="radio"
                      aria-checked={charId === c.id}
                      title={`${c.name} — ${c.blurb}`}
                      className={`cc-char-chip${charId === c.id ? " cc-char-on" : ""}`}
                      onClick={() => pickChar(c.id)}
                    >
                      {c.sheet ? (
                        <img src={`/cc/chars/${c.id}/frame0.png`} alt="" width={34} height={48} loading="lazy" />
                      ) : (
                        <span className="cc-char-classic" aria-hidden>▚</span>
                      )}
                      <span className="cc-char-name">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
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
              {verdict && <p className="cc-vs-verdict" role="status">{verdict}</p>}
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
              {verdict && <p className="cc-vs-verdict" role="status">{verdict}</p>}
              {duelCode && (
                <p className="cc-duel-live" role="status">
                  DUEL LIVE · <b>{duelCode}</b> · {duelCopied ? "INVITATION COPIED ✓" : "SHARE THE CODE"}
                </p>
              )}
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
                {canSubmit && data?.seed.source !== "vibe-launch" && !duelCode && (
                  <button
                    className="cc-btn"
                    onClick={createDuel}
                    disabled={duelBusy}
                    title="create an async duel — a rival opens the code and races your exact run"
                  >
                    {duelBusy ? "…" : "DUEL →"}
                  </button>
                )}
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
