# MASTER CHECKLIST — canonical execution order & tick-tracker

> Written 2026-09-30. This file is the SINGLE source of truth for what comes next.
> It exists so the project never jumps phases or loses its place (owner directive).
> Chat language FA · Doc language EN.
> Naming: product phases are **P0–P6** (this file). Growth sub-tracks are **G0–G2**
> (GROWTH-AND-HOOKS-STRATEGY §7) and visual versions **V1–V4** (ART-DIRECTION §7);
> both map INTO the P-phases below — never used standalone.

## 0. Rules of engagement (how this file is used)

1. **Next-task rule:** the first unticked, unblocked item in the lowest-numbered open
   phase is THE next task. No phase jumping. New ideas are appended to the correct
   phase as new items — never executed mid-air.
2. **Tick format:** `[x] YYYY-MM-DD @<commit> — one line of evidence`. An unticked box
   with a commit hash is a bug.
3. **Gates:** a phase is DONE only when its Gate criteria pass AND the owner confirms
   the gate in chat (FA). Precedent: Gate G1 was confirmed by the owner 2026-09-30.
4. **Session ritual:** read `worklog.md` → work → append worklog → tick items here →
   commit docs+code together.
5. Legend: 🔒 owner-dependent (blocked, not skippable) · ⛓ `<id>` depends on item ·
   🧪 has an automated verification (W5 suite / build / curl check).
6. **Autonomous-run delegation (owner directive 2026-10-02):** gate confirmations and
   phase-closure sign-offs are PRE-APPROVED for this run — evidence-based closure
   (W5 suite + e2e-gamer-bot + LambdaTest real-device + Sentry clean + live probe)
   substitutes for owner chat confirmation. Ping the owner ONLY for actions that are
   physically his (wallet txs, account creation, platform balance top-ups). Never
   loop/retry blindly; never fabricate results — bots and platform APIs are the
   source of truth.

## 1. Completed (for the record)

### P0 — MVP & production ship ✅
- [x] 2026-09-29 — Engine (fixed-timestep physics, coyote/buffer, crumble), Daily Seed
  (deterministic), mutations 5-pool, leaderboard v2 (env-gated Atlas + memory fallback,
  anti-cheat + rate limit), share loop (OG/meta/manifest), Death Card v1, deploy live
  @ https://candle-climber.vercel.app
- [x] 2026-09-29 — ECOSYSTEM_BAR v2 audit: 4🟢 5🟡 2🔴 (E1 deploy converted the big blocker)

### P1 — product rails ✅ Gate G1 PASS (owner-confirmed)
- [x] W3 stock-token rails (TSLA/AMZN/NFLX via stooq + vibe/vibe launch-of-the-day
  derived source, server date-clamp) 🧪
- [x] **W3.1** 2026-10-02 — **Yahoo v8 chart = primary stock feed** (no-key, no owner
  decision needed): stooq's anti-bot challenge blocks Vercel egress -> prod stock rails
  were honest-but-tokenless synthetic. New pure parser `src/lib/yahoo.ts`
  (parseYahooChart, contract-pinned incl. null-OHLC-must-not-become-0 rule) + fetch
  chain yahoo (query1/query2, 1wk/10y) -> stooq fallback -> synthetic tokenless;
  source label `yahoo` -> "live data", tf chips hidden for stocks; run token pins
  whichever feed served (two feeds can never mix one leaderboard). Live probe: Yahoo
  523 weekly rows w/ volume from sandbox; prod verification pending deploy
  (`/api/candles?symbol=TSLA` -> source). W5 +6 tests (205/205), tsc+lint+build green
- [x] W4 graduation arc (SUMMIT milestone, GRADUATED victory state, post-grad WORLD 2)
- [x] W5 vitest/bun anti-cheat & determinism suite — 25/25 (run-token, board-validation,
  stooq parser, vibe-launch, level determinism) 🧪
- [x] Evidence: prod @ `214eb03`, suite green, honest synthetic fallback documented
- [x] 2026-09-30 @ `d4d717d` — docs sweep: TOKEN-LAUNCHPAD-RESEARCH + GROWTH-AND-HOOKS-
  STRATEGY + ART-DIRECTION + CC-PLAN refs (owner directive: nothing must be lost)

## 2. Open phases (canonical order)

### P2 — Daily hooks & visual quality (contains growth G0) — no owner dependency
- [x] **P2.1** 2026-09-30 @ `6b1a699` — Visual **V1** shipped: terrain-v2.ts (pure
  translation) + render-v2.ts (sky/ghosts/ridge/playfield/foreground + squash-stretch,
  trail, pre-rendered glow sprites) behind `?renderer=v2` + HUD chip; engine untouched
- [x] **P2.2** 2026-09-30 @ `2295e97` — Hook **H1 ARCHIVE** shipped: archive.ts (pure:
  date validation no-future-absolute, closed-candle clamping, difficulty auto-tag
  CALM/ROCKY/BRUTAL/LEGENDARY, recent-dailies replay, whitelisted deep links) ·
  /api/candles honors `?date=` for PAST UTC dates only (today path byte-identical;
  launch source skipped for archive) · ArchiveBrowser (6 curated eras + 10 recent
  dailies, lazily computed tags, renderer=v2 carried) · archive runs are PRACTICE
  (submission suppressed; W1 staleness untouched) · live-verified: COVID/SNL/May-crash/
  FTX tag LEGENDARY on real binance data 🧪
- [x] **P2.3** 2026-09-30 @ `a0f6484` — Visual **V2 / H2 WEATHER** shipped:
  weather.ts (pure deriveWeather: ATR→wind 0..1 + seed-pinned direction,
  volume→fog lookahead veil w/ honest MIST baseline when feed lacks volume,
  red-tail→tremor; fixed label ladders DEAD CALM/BREEZE/GALE/STORM +
  CLEAR/MIST/FOG/SOUP) · render-v2: background-only wind sway (caps NEVER move —
  ART §1), wind streaks, cloud veil, right-edge fog, ≤2.2px cosmetic tremor ·
  Candle.v? optional volume plumbed binance+stooq (JSON/token fingerprint stable
  for volume-less feeds; feeds.test contract updated) · WEATHER HUD chip when v2
  finds real weather · live-verified: COVID terrain = STORM .99/FOG .49/LEGENDARY,
  today = GALE .41/CLEAR 🧪
- [x] **P2.4** 2026-09-30 @ `73a940f` — Hook **H4 DAILY REPORT** (minimal) shipped:
  report.ts (PURE aggregateDay: climbers/top/median/best-streak/total-height/
  top-mutation mode w/ deterministic tiebreak + reportNarrative/emptyNarrative —
  every figure read off the store, §8 honesty red line: no invented counts, no
  synthetic terrain claims) · /api/report (past completed days only, default
  yesterday; future/malformed fall back) · ready-panel episode block + COPY
  EPISODE share text (X posting lands with P5.1/O4) · live smoke: seeded W1-valid
  submission accepted (rank 1), empty-day episode honest, tomorrow-cliffhanger
  from public deterministic rotation 🧪
- [x] **P2.5** 2026-09-30 @ `2f90536` — Hook **H3 WRECKAGE** (minimal per-device)
  shipped: wreckage.ts (PURE recordWreck: immutable db, 30 wrecks/level cap,
  24-level eviction by latest-fatal ts, non-finite rejected; localStorage thin
  wrapper try/catch) · deaths freeze at the exact fall point (engine px/py via
  onDeath — decor only) · render-v2 ghost mini-candles tinted by cause
  (fell=faint/crumbled=coral/wicked=purple) + ×N cluster badges = honest danger
  map · archive levels keep their own wreck map per (symbol,date) · cross-user
  wreckage ⛓ O1 (core is storage-agnostic, survives the move) 🧪
- [x] **P2.6** 2026-09-30 @ `6b1a699` — W5 extension shipped: test/terrain-v2.test.ts
  (purity, byte-determinism, no-mutation, world2-append stability, semantics/grammar
  pins) — suite 36/36 green; lint + build green 🧪
- [x] **P2.7** 2026-10-01 @ `31f19fd` — **G2 owner-feedback hotfix** (owner playtest
  notes, accepted by tech review): control curve readable again (CAM_BASE 175→148,
  CAM_ACCEL 5.5→3.2, CAM_MAX 470→400, JUMP_V 760→815 ≈158px reach, COYOTE .09→.12,
  BUFFER .12→.16) · wider caps PLATFORM_W 62→72 + rarer full gaps .18→.13 ·
  **name-input bug fixed** (stage pointer-down + window keydown no longer hijack
  focus/Space while typing) · ready-panel de-clutter (DAILY REPORT folds to one
  line, howto teaches HOLD=higher jump, compliance line merged into footer) —
  suite 89/89, lint + build green 🧪

**Gate G2:** owner A/B-accepts V1 · H1/H2/H4 live on prod · bun test/lint/build green ·
determinism invariants intact (W5). Owner confirmation in chat required → then P3.

> ✅ **G2 PASS 2026-10-01 — owner-confirmed in chat**: "قطعا ورژن جدید خیلی خیلی
> بهتر هست… طبق پلن تایید میدم ادامه بدی" (A/B accepted; feedback landed as P2.7).

### P3 — Share loop & identity completion
- [x] **P3.1** Rivalry-tag input on Death Card (CC-PLAN D9 leftover) ⛓ none — DONE `normalizeRivalTag` pure normalizer (X alphabet, 1–15, leading @ tolerated, invalid ⇒ stamp omitted) + `RIVAL_KEY` persistence + optional input on death panel (gold-focus) + card stamp `CHALLENGE ISSUED → @handle — YOU'RE UP` + share text tags the rival. W5 94/94
- [x] **P3.2** Candle-rain mutation variant (CC-PLAN D9 leftover) — DONE `rain.ts` pure glyph math (34 falling candles, ~70/30 red/green, α≤0.32, engine-time driven, drawn BEHIND playfield in BOTH renderers) + pool 6th entry `rain` (DECOR-ONLY: mods ≡ BASE_MODS, daily difficulty untouched) + W5 tests pin fairness + determinism. 100/100
- [x] **P3.5** **Timeframe selector** (owner proposal 2026-10-01, tech-reviewed ACCEPT) — DONE 4 chips on ready panel (1W classic default · 1D · 4H · 1H), hidden for stooq/launch/archive. Interval whitelist in level-source (INTERVALS + isInterval + INTERVAL_MS); synthetic terrains seeded per date|interval (legacy 1w byte-identical); cache key + binance klines carry interval; run-token HMAC binds interval (legacy tokens verify as 1w, forged tf → null); boards PER-TF in memory+Mongo (legacy rows read as 1w, never mixed); submission interval pinned from token; report stays classic-board; deep link ?interval= + TF_KEY persistence; card shows honest tf label. Archive stays daily-only V1. W5 108/108
- [x] **P3.6** **Skill-jump controls** (PLATFORMER-UX-RESEARCH contract §6) — DONE RUSH: `Engine.rush` + `pressRush()/releaseRush()`, SHIFT held = camera ×1.28 (after mods, may exceed un-rushed cap) + gains ×1.25 (RUSH_GAIN in scoring.ts, composed after mode/combo, rounded last); gravity-hang: GRAVITY×0.5 while rising with jump held (Celeste #3); MAX_SCORE_PER_CANDLE 140→175 covers rushed world2 full-combo; Shift wired in GameCanvas (repeat/typing-safe, release unconditional); howto line + hint bubble teach RUSH; free-brake stays REJECTED per research. W5 116/116
- [x] **P3.7** **Sentry production monitoring** (owner directive 2026-10-01) — DONE org `james-thomas-st` · project `candle-climber` · `@sentry/nextjs@11.1.0` wired for client/server/edge (`instrumentation.ts` + `instrumentation-client.ts` + runtime configs), `onRequestError` hook, `global-error.tsx` boundary, `GET /api/debug-sentry?go=1` probe; replay on-error 100% / session 0%; privacy `dataCollection{userInfo,cookies:false}`; release pinned to git SHA + source maps uploaded at build (SENTRY_AUTH_TOKEN); verified end-to-end — probe event `70d24b51…` landed as `CANDLE-CLIMBER-1` with correct release/file attribution. W5 116/116, build+lint green
- [x] **P3.8** **E2E gamer bot** (owner directive 2026-10-01, GitHub Actions + Playwright — free)
  — DONE `scripts/e2e-gamer-bot.ts` robot player boots LIVE prod `?renderer=v2`, starts via Space/button,
  plays jump bursts + RUSH, retries on death panels (valid behavior), captures boot/play/death screenshots +
  console log; FAILS on uncaught pageerror, non-whitelisted console.error, or static canvas (render liveness via
  frame diff). `.github/workflows/e2e.yml`: push main + nightly cron 04:00 UTC + manual dispatch, artifacts
  uploaded 14d. Verified locally against prod: PASS 24s, 4 deaths (valid), 0 errors, canvas animating —
  death rate also quantitatively re-confirms owner feedback F1 (early deaths). W5 116/116
- [x] **P3.9** **G2-F1 second pass — start fairness** (gamer-bot metric, owner full-delegation
  2026-10-01) — DONE clean NO_RUSH bot baseline (3x60s vs prod): naive input still died at 2–3s exactly at the
  pad→terrain transition; fix LAUNCH_PAD 4→6 + EASE window (first 2 post-pad candles |Δy|≤48px + gapless) —
  deterministic, identical for all players, real-chart shape resumes after ease; re-measure on prod: first-death
  10–31s (immediate-death mode eliminated), deaths/60s unchanged (3–5 = normal naive cadence). W5 +ease pin
  117/117, tsc+lint green
- [x] **P3.10** **Sentry incident CANDLE-CLIMBER-2 — production unhandled rejection** (2026-10-01,
  owner emailed the new-issue alert) — real player (Chrome 156/Win) on `/?renderer=v2`: `sound.ts ac()` used
  `void ctx.resume()` → Chrome rejects with DOMException (keys exactly `code, message, stack` — the Sentry
  synthetic signature) when resume() fires outside a user-gesture window; setTimeout-deferred sfx (milestone/
  victory) do that by design. Fix `.catch(()=>{})` (audio = best-effort) + same-class hardening: submitScore
  try/finally had NO catch (any POST/JSON failure escaped as unhandled rejection) → caught with graceful
  fallback. Verified end-to-end: event ff17c94e → root cause → fix pushed `be9b97a` → CI + e2e-bot + Vercel
  green → issue resolved with note. Lesson: DOMException inherits Error.stack in Chrome — enumerate keys, not
  message, when triaging synthetic rejections. W5 117/117, tsc+lint green
- [ ] **P3.3** 🔒→🔓 **O6** Real-device mobile QA pass (E10) — LambdaTest cloud real-device
  session (org 3358645, creds on file) replaces the "owner's own phones" reading of E10;
  owner authorized platform-driven QA 2026-10-02 — REQUIRED before any launch announcement
  → **PROGRESS 2026-10-02**: mobile-viewport QA via LambdaTest desktop grid + Chrome
  mobile-emulation (Pixel 7 profile, 412×915): PASS — 15 char chips render, START works,
  canvas animating, 0 runtime errors, video+console on dashboard (session
  d7574597efeeed8418b85c36eb76bd0e, screenshots `qa/realdevice-*`). REAL-DEVICE attempts
  (Galaxy S23 / Pixel 7 / Pixel 6 Pro × 3 rounds, queueTimeout 420s) all ended
  `create-test-timeout` — ROOT CAUSE CONFIRMED 2026-10-02 via direct API error:
  **"Real Mobile Automation not allowed on your current plan"** — real-device
  automation is plan-gated, not a queue issue. Dashboard login (Real Time Testing
  interactive route) needs account email+password — NOT on file (only
  username+access-key, which work for API/grid only; username login → "Invalid
  email"). REMAINING for closure: owner provides EITHER dashboard email+password
  (or sets one) → I run interactive real-device session + capture evidence, OR
  upgrades plan / enables real-device automation → I run the automation script
  (scripts/lambdatest_realdevice.py, ready), OR runs 1 session on his own phone.
  Mobile-emulation PASS evidence stands (session d7574597efeeed8418b85c36eb76bd0e) 🧪
- [x] **P3.15** **Cosmetic fix from mobile QA** — `TODAY&apos;S` rendered literally
  (HTML entity inside a JS string literal, not JSX text) → real apostrophe; found in
  LambdaTest emulation screenshot; bun test 126/126, tsc+lint+build green (2026-10-02)
- [ ] **P3.4** ✅ **O5 RESOLVED by owner himself 2026-10-02**: mascot V2 = our own VIBES
  pipeline (owner reviewed VIBES-CONTACT-SHEET + venom-variants). Final directives:
  (a) 03_superwick + 06_pump-bubble rejected & archived in `rejected/`; (b) venom final
  design = `MASCOT/VIBES/venom-variants/venom-v3-half-fused.png`; (c) USE ALL OTHER
  characters — VIBES (cop/bull/frost) + all MASCOT root concepts — "همشون خوبن و با کیفیت".
  Game integration lands as P3.11–P3.14 below.
- [x] **P3.11** **Character roster → game sprites (14 chars)** — DONE 2026-10-02. 4-frame
  96px transparent sheets via proven pipeline (image-edit side-profile prompt + magenta/green-key
  postprocess + alpha-erosion + column-split): 5 existing (trader frame0 restored from manifest
  coords / bot / cowboy / dapper / zombie) + 5 MASCOT concepts (scarfrunner green-key,
  visordroid, grump, goblin, cadet) + 4 VIBES (wickvenom-from-v3 assembled from dual-raw
  best-frames, wickcop, goldenbull, frostliquidator). Venom identity rule held in all 4 frames
  (half-cream/half-black). Shipped to `public/cc/chars/*` + KB `MASCOT/SPRITES/` + contact sheet
  `ROSTER-CONTACT-SHEET.png` (commit fe6f8a0) 🧪
- [x] **P3.12** **Character registry + pre-game SELECT screen** — DONE 2026-10-02.
  `src/game/cc/characters.ts` AUTO-GENERATED from manifests (gen_characters_ts.py): 15 entries
  (14 sprites + procedural CLASSIC), pure data + getChar/isValidCharId/rosterList, no I/O (W5).
  Select UI on ready panel: 15 portrait chips (frame0), aria radiogroup, persists
  `cc_char_v1`, deep-link `?char=` wins over stored, invalid→classic. Renderer feed via
  charIdRef (RAF never re-subscribes) 🧪
- [x] **P3.13** **Vibe mood→effect profiles in render-v2** — DONE 2026-10-02. drawCharFx:
  15 profiles (venom=red glitch+vignette, cop=cyan scanlines, bull=golden halo+coin sparks,
  frost=snow+ice vignette, scarf=rose petals, visor=lavender glow, grump=moss motes,
  goblin=whisper fog, cadet=steel glints, trader=ticker shimmer, scout=neon grid, cowboy=dust,
  dapper=film grain, zombie=toxic haze) — DECOR-ONLY, drawn last inside shake transform,
  every particle a pure function of (charId, engine.time) via hashString — deterministic, zero
  gameplay/physics impact (W5 purity rule) 🧪
- [x] **P3.14** **Multi-char verification + ship** — DONE 2026-10-02. W5 extension
  `test/characters.test.ts` 9 tests (purity/manifest safety/fx coverage/guard); suite 126/126;
  tsc+lint clean; build green; e2e-gamer-bot PASS (20s, 3 valid deaths, 0 errors); NEW
  `scripts/e2e-char-select.ts` — sheet:200 · picked:true · stored:wickvenom · chipImgs:14 ·
  onChip:WICK VENOM · animating:true · errors:0 🧪

**Gate G3:** rivalry tag + candle-rain live 🧪 · one clean real-device session (LambdaTest)
· character system merged (P3.11–P3.14) → evidence-based closure (owner pre-approved
2026-10-02) → P4.

### P7 — Rival AI & async duels (owner brainstorm, approved direction 2026-10-02)
> Executable whenever P4–P6 are owner-blocked; does NOT gate them. Order below is
> build order. All items decor/economy-side, W5 untouched.
- [x] **P7.1** **Rival AI bot (local, zero-infra)** ✅ 84c0f10 (2026-10-02): headless engine + forward-sim planner, 4 personalities, translucent rival, SOLO/VS BOT toggle; gates tsc/lint/152 tests/build green — second headless Engine instance in the
  same world, heuristic jump planner (lookahead + jump-feasibility), character-personality
  params (risk/precision per vibe: venom reckless, cop precise, bull greedy, frost patient);
  rendered as translucent rival climber with its own skin+FX; toggle: "solo / vs bot" 🧪
- [x] **P7.2** **Ghost runs** — record position-stream (NOT inputs — physics determinism not
  required) per run, replay translucent ghost with rival's skin; storage: leaderboard-store
  pattern (memory/Mongo) ⛓ none · server route ⛓ O1 (durability) ✅ shipped (2026-10-02): 30Hz recorder cap 3600, /api/ghosts token-pinned top-5 + 7d TTL, replay w/ recorded skin, GHOST toggle default ON; E2E verified (valid 200/GET/forged 403/horizon 400)
- [x] **P7.3** **Async duel** — challenge link/code → both climb SAME symbol+date+interval
  (buildPlatforms already byte-deterministic per (candles,seed)) → duel record + winner
  verdict + death-card integration (rivalry tag P3.1 becomes the invitation channel) ⛓ O1
  ✅ shipped (2026-10-02): /api/duels (POST token-pinned create w/ physical caps, GET by code),
  6-char unambiguous codes (?duel=CODE deep link pins terrain + replays challenger's stream),
  duel banner + verdict (score → candles → draw) + local W-L-D tally + DUEL → button on death
  panel + duel stamp on death card; bot/dual coexist, verdicts local-only, W5 untouched;
  25 new tests (199 total); E2E: create/fetch/forged 403/physical 403/horizon 400/bad-code null
- [ ] **P7.4** **Realtime live race** (only on traction) — external WS service (PartyKit or
  self-hosted); both clients simulate locally, avatar sync ~200ms; matchmaking queue
  ⛓ infra decision (owner ping required for new service spend)

### P4 — $WICK launch (contains growth G1) — heavy owner dependency
- [ ] **P4.0** 🔒 **O2** Owner: faucet test ETH into launch wallet
- [ ] **P4.1** 🔒 **O3** Owner: wizard launch per TOKEN-LAUNCHPAD-RESEARCH §9
  (Product & Utility · native ETH pair · tax 2% holders-heavy · airdrop board ~10% ·
  minimal opening buy) — one tx, verified on explorer 🧪
- [ ] **P4.2** Balance Gate tiers — server-side on-chain balance read; wallet identity
  additive to W1 run-tokens (W5 untouched) ⛓ P4.1
- [ ] **P4.3** Hook **H7 WICK VAULT** ⛓ P4.1 · vault visuals from V4 ⛓ P2.1
- [ ] **P4.4** Airdrop-weight accounting (streak / prediction / archive-marathon weights,
  server-side, deterministic) ⛓ P4.1 · durability recommended ⛓ O1
- [ ] **P4.5** #project-showcase post (game URL + token URL + how-to-play, DRGN/FORGE
  template) ⛓ P4.1
- [ ] **P4.6** Hook **H5 ROUTE PREDICTION** — draw-tomorrow's-path; pre-launch capable,
  weights land with P4.4 ⛓ O1 (weights)

**Gate G4:** token contract verified on explorer · Balance Gate live on prod · showcase
post live → owner confirmation → P5.

### P5 — Community flywheel
- [ ] **P5.1** 🔒 **O4** Owner: W7 X account creation → Daily Report posting cadence starts
- [ ] **P5.2** Discord scan with saved `.discord_token` (scripts/discord_scan.py) →
  builders' launch-tx archive (research op, gitignored output)
- [ ] **P5.3** Platform-side visibility ops (Discover tabs, guild presence, leaderboard
  cross-promo)

**Gate G5:** 7 consecutive daily-report posts · referral traffic measurable in board
metadata → owner confirmation → P6.

### P6 — Graduation & token economy (contains growth G2) — ⛓ the 5-ETH meter itself
- [ ] **P6.1** Graduation-day event runtime (Merkle delivery comms, celebration scene —
  ART V4) — build BEORE the meter fills
- [ ] **P6.2** Hook **H6 MIRROR** — $WICK's own chart as a level ⛓ graduation
- [ ] **P6.3** In-game spend/burn (legal once transfers unlock) ⛓ graduation
- [ ] **P6.4** Treasury-funded tournaments ⛓ graduation
- [ ] **P6.5** Burn-counter HUD ("the game eats its own supply") ⛓ graduation

**Gate G6:** graduation tx confirmed on explorer · Mirror live · burn counter live →
owner confirmation → mainnet watch (CC-PLAN D11–14).

## 3. Owner-dependency register 🔒

| ID | Item | Blocks | Owner action |
|---|---|---|---|
| **O1** | `DATABASE_URL` set in the **Vercel dashboard** (already present in local `.env` since 2026-09-30) | H3 full · H4 full · P4.4 durability · E9 | add env var in Vercel → redeploy |
| **O2** | Faucet test ETH | P4.0 | wallet action |
| **O3** | W6 wizard launch signature | all of P4 | wallet action (§9 checklist ready) |
| **O4** | W7 X account | P5.1 | account creation |
| **O5** | Mascot V2 brief | P3.4, E6 | character re-brief |
| **O6** | Real devices for QA | P3.3 | 1 session, 1–2 phones |
| **O7** | ~~`SENTRY_AUTH_TOKEN` in the **Vercel dashboard**~~ ✅ **DONE 2026-10-01** — owner supplied new Vercel API token → env vars `SENTRY_AUTH_TOKEN` (secret) + `NEXT_PUBLIC_SENTRY_DSN` added via API to all targets → redeployed → root-caused missing source-map upload (no explicit `release` in `withSentryConfig` + Next 16 emits no client `.map` by default) → fixed in `next.config.ts` (commit `c8b8301`) → verified end-to-end: prod probe event attributed to release `c8b8301c…` with symbolicated frame `src/app/api/debug-sentry/route.ts` | ~~source maps + release pinning on Vercel builds~~ none | none — closed |

## 4. Gate ledger

| Gate | Phase | Status |
|---|---|---|
| G1 | P1 | ✅ PASS 2026-09-30 (owner-confirmed) |
| G2 | P2 | ✅ PASS 2026-10-01 (owner-confirmed in chat; feedback → P2.7) |
| G3 | P3 | ⬜ pending |
| G4 | P4 | ⬜ pending |
| G5 | P5 | ⬜ pending |
| G6 | P6 | ⬜ pending |

## 5. Current pointer

> ▶ **NEXT ACTION (autonomous run, owner directive 2026-10-02):** P3.11 → P3.12 →
> P3.13 → P3.14 (character system) → P3.3 LambdaTest real-device QA → close Gate
> G3 with evidence → P7.1–P7.3 (rival AI + ghost + async duel) while P4–P6 remain
> owner-blocked (wallet/account/balance actions). Krea API image-gen still 402
> (separate API balance from workspace) — internal image-edit engine is the active
> asset engine; Krea pipeline ready for when the owner tops up.
> ALL code items of P3 are shipped: P3.1 rivalry tag, P3.2 candle-rain,
> P3.5 timeframe selector, P3.6 skill-jump (RUSH + gravity-hang).
>
> **UPDATE 2026-10-02 (later session):** character system verified LIVE on prod via
> LambdaTest mobile-emulation QA (PASS: 15 chips, animating, 0 errors) + P3.15
> cosmetic fix shipped; real-device session still pending (plan slots — owner
> verify). Infra: Codespace exec channel LIVE (paramiko-over-stdio bridge, KB
> tools/), 8 service secrets migrated to repo-level Codespaces secrets. G3 closure
> remains blocked ONLY on the real-device session; everything else of G3 verified.
> UPDATE 2026-10-02 (latest): P7.1 @ 84c0f10 + P7.2 ghost runs SHIPPED (gates green: tsc/lint/174 tests/build; E2E: token-verify 403/400 contracts live). Next active build item: P7.3 async duel (challenge link/code → same symbol+date+interval → duel record + winner verdict + death-card integration).
> UPDATE 2026-10-02 (final): P7.3 async duel SHIPPED — P7 social loop complete (bot → ghost → duel). Gates: tsc/lint/199 tests/build green + live E2E on /api/duels. Also fixed: pre-existing test-dir typecheck gap in ghost.test.ts (missing maxCandles arg). NEXT: no active build item — P7.4 realtime only on traction; G3 blocked ONLY on LambdaTest real-device session (owner); P4–P6 owner-blocked. Suggested owner items: LambdaTest slots, Copilot web signup + $0 spending cap, Azure no-card activation.
>
> **UPDATE 2026-10-02 (autonomous run 2, owner directive "raise execution level — don't stop"):**
> W3.1 CLOSED via Yahoo v8 primary stock feed (no-key, no owner decision needed) —
> prod stock rails become real+scored pending deploy probe. P3.3 root cause confirmed
> via direct API error: "Real Mobile Automation not allowed on your current plan" —
> plan-gated, NOT a queue issue; interactive Real-Time-Testing route needs dashboard
> email+password (username+accesskey on file → API/grid only; login test → "Invalid
> email"). Three unblock paths documented on P3.3. Recovery of the reset sandbox done
> via KB + Codespaces secrets channel (fantastic-space-journey vault, now stopped;
> .lt_user/.lt_key restored 0600; bridge script paramiko-5.0-compatible). Gates this
> run: 205/205 tests, tsc+lint+build green. NEXT in queue: visual-debt sweep (now
> unblocked — tech layers P7.1–P7.3 done), then idle until owner input.
