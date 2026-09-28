# PROJECT AUDIT — Candle Climber

> Audit #1 · 2026-09-29 · Auditor: senior-PM pass (full code inspection, not a summary review)
> Scope: everything shipped against the research-derived spec (CC-PLAN + GAME_DESIGN + INFRASTRUCTURE).
> Method: worklog reconstruction → spec re-read → line-by-line code inspection of all 14 game/app
> source files → fresh-install verification (`bun install --frozen-lockfile`, `eslint`, `tsc --noEmit`,
> `next build`) → git history forensics → infra/credential state review.
> GitHub Actions API was rate-limited (403) from this environment, so Actions run history could
> not be listed; the CI trigger itself was verified at byte level (boolean probes, see F1).
> Method note: this sandbox's bash output sanitizer eats `[m` sequences (ANSI remnants), which
> initially produced a false "corrupted YAML" reading of ci.yml — caught by byte-level re-check.
> Bracket-bearing file content is verified via boolean probes / the Read tool only.

## 1. Verdict snapshot

| Area | State | Note |
|---|---|---|
| Core gameplay (engine/level/physics) | ✅ SOUND | Matches GAME_DESIGN §3 exactly, quality is real |
| Daily seed + determinism | ✅ SOUND | Identical worldwide, verified in code |
| Market data pipeline | ✅ SOUND | Proxy + cache + synthetic fallback all present |
| Leaderboard + anti-cheat | ✅ SOUND (logic) / ⚠️ wiring | Logic solid; Mongo path has 2 findings |
| Onboarding + market legibility | ✅ SHIPPED | Hints + MiniChart + REAL MOVE/DIFFICULTY |
| Death Card v2 | ✅ SHIPPED | 1080×1350, mutation stamp, rival line |
| Build / lint / typecheck | ✅ GREEN (fresh install) | Local env was stale, not the repo |
| CI | 🟡 trigger healthy, run history unconfirmed | Actions API 403 from this env |
| Deployment (Vercel + Atlas) | ⬜ owner-gated | Still pending — the real p1 gate |
| Link-share readiness (OG/manifest) | ⬜ missing | Blocks the Death Card virality loop |
| Visual/character phase | ⏸️ PARKED by owner | Character-brief misunderstanding acknowledged |
| Zero-cost invariant | ✅ HELD | No paid service anywhere in deps/code |

**Overall: the product underneath is in better shape than the process around it.**
One real process defect (push outage) plus one wiring bug (latent until deploy day) and several
doc-drift items. An early suspicion of dead CI was investigated and **withdrawn** (F1).

## 2. Feature checklist — planned vs shipped (evidence)

Legend: ✅ shipped & verified in code · 🟡 partially · ⬜ not started (by plan) · ⏸️ parked by owner

### CC-PLAN §3 (MVP scope)
- [x] ✅ Canvas 2D engine: fixed-timestep 60 Hz accumulator, coyote 0.09s, buffer 0.12s, jump-cut 0.72, crumble 0.26s — `engine.ts`
- [x] ✅ Candle data: Binance klines server proxy (8s timeout, ≥40-candle sanity), 1h memory cache + 5min CDN header — `api/candles/route.ts`
- [x] ✅ Daily seed: `cc-daily-v1:<UTC date>` → hash → 6-symbol crypto watchlist rotation — identical level worldwide
- [x] ✅ Deterministic synthetic fallback (same seed, `source:"synthetic"` flag surfaced in UI)
- [x] ✅ Scoring: candlesPassed × streak multiplier (cap ×7 = `1+12×0.5`), local best `cc_best_v1` — `engine.ts`, `GameCanvas.tsx`
- [x] ✅ Death Card 1080×1350: score/symbol/cause/rank, mutation stamp, rival gap line, #1 flex line, Download + WebShare — `deathcard.ts`
- [x] ✅ Global leaderboard: GET top-50 / POST entry, name+date sanitize, 20/min/IP rate limit, score cap 10M, score ≤ candles×70+20 — `api/leaderboard/route.ts`
- [x] ✅ Env-gated Mongo Atlas M0 → memory fallback (wiring bug found — see F3) — `leaderboard-store.ts`
- [x] ✅ vibe/vibe palette locked in renderer `COLORS` (bg #101214, lime #CCFF00, up #5BD08A, down #E07856, purple #6A63C8) — `render.ts`
- [x] ✅ WebAudio synth, zero assets; mute persisted (`cc_mute_v1`), gesture-unlock — `sound.ts`

### GAME_DESIGN §4b / Task 9 features
- [x] ✅ 5-pool daily mutations (`clean/lowgrav/heavy/rush/fragile`), seed `cc-mutation:<date+symbol>`, ready-banner + HUD chip — `mutations.ts`
- [x] ✅ Market legibility: REAL MOVE %, FRIENDLY/SPICY/BRUTAL, MiniChart (last 40 candles) on ready screen — `market.ts`, `MiniChart.tsx`
- [x] ✅ First-run hint bubbles: shown for first 2 runs (`cc_runs_v1`), auto-off after candle 6 — `engine.showHints`, `render.drawHints`
- [x] ✅ Ready-screen TOP-3 + rival gap line + GLOBAL RANK after submit — `GameCanvas.tsx`
- [x] ✅ Game-feel: float score texts, slow-mo death beat, milestone sfx (streak 5/10), screen shake, particles

### Milestones (CC-PLAN §6)
- [x] ✅ D1–3 M1 playable slice
- [x] ✅ D4–7 leaderboard v2 + death card v2 + game-feel pass  (🟡 showcase GIF ⬜, Vercel ⬜)
- [x] ✅ D8–9 mutations half (🟡 candle-rain visual variant ⬜, X-handle rivalry tag ⬜)
- [x] ✅ M2 follow-up: market legibility + onboarding (868d987), CI-intent fix (515d95b — see F1: didn't actually fix CI)
- [ ] ⬜ D10+ token / duels / guild / mainnet — future phases by design (correctly not started)
- [ ] ⏸️ Visual identity phase — parked by owner; see §6

## 3. Findings register

### P0 — blockers
**F1 · CI trigger — investigated, finding WITHDRAWN (documented for the record).**
Initial inspection suggested `.github/workflows/ci.yml` contained `branches: ain]` (corrupted
`[main]`) in every commit since the M1 root. Byte-level verification (boolean probes, plus a
local-vs-origin hash compare) proves the file is **healthy and identical to origin** — the
"corruption" was this sandbox's bash output sanitizer stripping `[m` sequences from displayed
text. Residual risk: actual Actions run history could not be listed (API 403), so "CI green at
515d95b" remains owner-visible but not independently re-verified here. Owner can eyeball the
Actions tab in 10 seconds; no code change required.

**F2 · Push capability is down — local commit stranded.**
The sandbox reset wiped `.gh_token`; local `main` is ahead of `origin/main` by `774dbf6`
(scripts/render_nim.py + `.nim_key` gitignore line). Nothing else diverges (`git diff origin/main main`
confirms only those 2 files). Owner action: re-send a **fresh** PAT (the old one was chat-pasted —
rotate per standing policy, store in 1Password per INFRASTRUCTURE §3). Until then, no fix can ship.

### P1 — fix at/before deploy
**F3 · MongoStore is re-instantiated per request.**
`getBoard()` returns `new MongoStore()` on every call when `DATABASE_URL` is set; only MemoryStore
is memoized. Each request constructs a new `MongoClient` (per-instance `connecting` promise), so
under load Atlas M0 (10-connection cap per tier) suffers connection churn, and the `disabled`
circuit-breaker resets every request, so a failing Mongo is retried forever instead of falling
back once. Logic itself is fine; it's a singleton bug. Fix: module-level memoization (3 lines).
Note: this bug is currently **unreachable** (no DATABASE_URL anywhere yet) — but it would detonate
exactly on deploy day, so it is P1, not P3. (Dead CI would not have caught it either way — it's a
runtime behavior, not a type/lint error — but F1's lesson stands: keep CI provably alive.)

**F4 · The Death Card virality loop lands on a bare link.**
`layout.tsx` has title/description/keywords/icons but **no `openGraph`, no `twitter` card meta,
no `metadataBase`, no PWA manifest**. Death Cards are designed for X/Twitter sharing; anyone who
clicks through currently gets a link preview with no card. This is the already-agreed app-shell
polish task — audit confirms it is still open and elevates its priority (it serves pillar #3
"Death is the content"). favicon exists (`cc-icon.svg`).

**F5 · Owner-gated p1 chain still open.**
Vercel deploy (browser OAuth) → Atlas M0 → `DATABASE_URL` to Vercel env + `.env.local`. Until
then the leaderboard is memory-only (resets on restart) and there is no public URL. No code
blocks this — F3's fix should land first.

### P2 — quality / hygiene
**F6 · Empty-candle crash path.** If `/api/candles` itself is unreachable, the client fallback
builds `CandleData` with `candles: []`; `buildPlatforms([])` → `[]`, and the `Engine` constructor
does `plats.find(...) ?? plats[0]` → `start.y` throws on **START CLIMB click**. Rare (API totally
down) but it's a user-facing crash with a one-line guard (client-side synthetic or disabled start).

**F7 · `next.config.ts` sets `typescript.ignoreBuildErrors: true`.** Build is not authoritative
for type safety; only CI's separate `tsc --noEmit` step was — and CI is dead (F1). With tsc now
verified green on fresh install, this flag should be removed so `next build` fails loudly.

**F8 · Prisma template leftovers.** `prisma/schema.prisma` (sqlite + User model), `db:*` scripts,
`@prisma/client` dep are scaffold residue while the real DB is Mongo. Beyond dead weight there's
a semantic collision: Prisma's `DATABASE_URL` (sqlite path) vs the leaderboard's `DATABASE_URL`
(mongo URI) — confusing at 2 a.m. on deploy night. Remove or quarantine.

**F9 · Documentation drift (4 items).**
1. README architecture section still says leaderboard "(in-memory)" — stale vs M2 env-gated store.
2. README status table is headed "M1 vertical slice" — M2 + features have shipped since.
3. CC-PLAN §4 lists `src/game/cc/candles.ts` (client fetch) which does not exist; the client fetch
   lives in `GameCanvas.tsx` and the fetch/seed logic in `api/candles/route.ts`.
4. CC-PLAN §5 still names "Supabase free tier" for p1 DB — superseded by INFRASTRUCTURE.md
   (Atlas M0); and GAME_DESIGN §9 still presents the V1 blockbot mascot as "locked" while the
   character phase is now parked (see §6). Docs should say what is, or say they're historical.

**F10 · Per-instance rate limiting + crude memory guard.** `hits.clear()` at 5000 keys and
per-instance (not global) limiting are fine for Hobby scale; documented as accepted-for-now,
revisit with Sentry/SimpleAnalytics at p2. `x-forwarded-for` trust is acceptable on Vercel.

**F11 · `scripts/` is gitignored yet `render_nim.py` is tracked.** It was force-added in `774dbf6`
(defensible — preserves it across sandbox resets) but the policy is undocumented. Either un-ignore
`scripts/` for tooling worth keeping or record the force-add convention in the worklog (done here).

### P3 — cosmetic / notes
- `package.json` name is still `nextjs_tailwind_shadcn_ts` 0.2.1 → rename `candle-climber`.
- `DeathCause 'wicked'` has a death-card line but the engine never emits it (future hook — document, don't delete).
- Viewport: the canvas scales uniformly by width, so non-16:9.6 viewports (portrait phones) see
  more world vertically and the painted backdrop only covers logical y ≤ 480 (below is page bg —
  currently the same color, so invisible). Fold into p2 mobile QA (BrowserStack, already planned).
- `mongodb` was missing from the *local stale* `node_modules` after the sandbox reset and made
  `tsc` fail locally — repo is fine (`bun install --frozen-lockfile` fixes it; package.json and
  lockfile are correct). Lesson recorded in §7 checklist item C2.

## 4. Verified-good inventory (kept short, all evidence-checked)

Determinism chain (seed → level → mutation → synthetic fallback) is airtight and cross-client;
physics fairness clamps (`MAX_UP 112 < jump reach ≈137`) are correct; anti-cheat constant (×70)
matches the engine's true max gain (10 × 7 = 70); all four localStorage keys match spec;
palette/font lock matches §2 of the plan; the API surface is exactly the planned 2 routes;
secrets hygiene is clean (no secrets in tree, `.env*`, tokens, `.nim_key`, `research/` all ignored);
zero-cost invariant holds (no paid dependency anywhere).

## 5. Remediation plan (ordered)

| # | Action | Findings | Effort | Owner |
|---|---|---|---|---|
| 1 | Owner sends fresh PAT (rotate, 1Password) | F2 | 2 min | owner |
| 2 | Push stranded `774dbf6` + this audit (committed locally) | F2 | 1 cmd | me |
| 3 | Owner eyeballs Actions tab: runs exist & green for HEAD | F1 residue | 10 sec | owner |
| 4 | MongoStore singleton fix + guard empty-candle crash | F3, F6 | ~30 min | me |
| 5 | App-shell polish: OG/Twitter meta, metadataBase, PWA manifest | F4 | ~1 h | me |
| 6 | Vercel deploy via browser OAuth (owner) → Atlas M0 → `DATABASE_URL` | F5 | owner-gated | owner+me |
| 7 | Remove `ignoreBuildErrors`, prune Prisma leftovers, rename package | F7, F8 | ~30 min | me |
| 8 | Docs truth-pass: README status/arch, CC-PLAN §4–5, GAME_DESIGN §9 parked note | F9 | ~45 min | me |
| 9 | Showcase GIF + mobile QA pass (BrowserStack) | P3 viewport item | p2 | me |
| 10 | Resume visual phase when owner re-briefs the character | §6 | parked | owner |

Steps 1–3 unblock everything; 4–5 are the pre-deploy code window; 6 is the actual p1 finish line.

## 6. Parked work register (per owner decision 2026-09-29)

- **Visual/character phase: PARKED.** Owner identified a mismatch between the character they
  intend and the one interpreted from the v8/v9 seeds; consequently `docs/ART_PROMPTS_V2.md`
  is reclassified **DRAFT — not a lock**; nothing in it is approved for production identity.
  The in-game procedural blockbot (V1 style) remains purely a gameplay placeholder with **zero
  coupling** to art assets (verified: renderer is 100% procedural — parking costs nothing).
- `scripts/render_nim.py` (NIM/flux.1-dev path) stays committed but dormant; no key requested.
- When resumed: owner re-briefs character intent first (words or references), identity doc gets
  rewritten from that brief, then the reachability protocol applies before any design lock.

## 7. Reusable audit checklist (rerun this before every milestone/ship)

**C1. Process live-ness** — CI trigger verified in the file on origin **via boolean byte probes**
(this sandbox's bash output mangles bracket sequences — never trust pasted file text) · at least
one green Actions run exists for HEAD SHA · no commit claims verified without an artifact link.
**C2. Fresh-install truth** — clean clone + `bun install --frozen-lockfile` + lint + `tsc
--noEmit` + build all green (never trust a reused `node_modules`).
**C3. Spec-to-code diff** — every file the plan §4 names exists *somewhere* (or the plan is
updated) · every constant the design doc cites (crumble 0.26s, cap ×70, hints-off candle 6,
5 mutation pools) grep-verified in code.
**C4. Failure paths** — kill the API and try to play · set a bogus `DATABASE_URL` and confirm
graceful fallback · confirm a store outage falls back once, not per request.
**C5. Secrets & cost** — `git ls-files` shows no env/token/key files · deps contain no paid
services · env template documents every variable the code reads.
**C6. Share-loop readiness** — OG/Twitter preview renders · manifest valid · death-card PNG
downloads on mobile Safari/Chrome.
**C7. Docs honesty** — README status = reality · no doc contradicts another (this audit found 4).
**C8. Credential rotation** — any token ever pasted in chat is rotated and stored in 1Password.
