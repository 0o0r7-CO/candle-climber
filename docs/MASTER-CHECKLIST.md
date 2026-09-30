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
- [x] W4 graduation arc (SUMMIT milestone, GRADUATED victory state, post-grad WORLD 2)
- [x] W5 vitest/bun anti-cheat & determinism suite — 25/25 (run-token, board-validation,
  stooq parser, vibe-launch, level determinism) 🧪
- [x] Evidence: prod @ `214eb03`, suite green, honest synthetic fallback documented
- [x] 2026-09-30 @ `d4d717d` — docs sweep: TOKEN-LAUNCHPAD-RESEARCH + GROWTH-AND-HOOKS-
  STRATEGY + ART-DIRECTION + CC-PLAN refs (owner directive: nothing must be lost)

## 2. Open phases (canonical order)

### P2 — Daily hooks & visual quality (contains growth G0) — no owner dependency
- [ ] **P2.1** Visual **V1** — candle→world translation grammar + 5-layer parallax +
  juice pass, behind `?renderer=v2` feature flag for owner A/B ⛓ none (render-only
  by construction) · ART-DIRECTION §2–3,6
- [ ] **P2.2** Hook **H1 ARCHIVE** — era browser + difficulty auto-tags (minimal version
  on current renderer; era palettes land with V1/V3) · recommended after P2.1
- [ ] **P2.3** Visual **V2** — Weather systems (ATR wind, volume fog, session sky) ⛓ P2.1
- [ ] **P2.4** Hook **H4 DAILY REPORT** — end-of-day aggregate card; same-day aggregates
  work on memory store; cross-day history ⛓ O1
- [ ] **P2.5** Hook **H3 WRECKAGE** — frozen death ghosts; per-device partial possible;
  full cross-user ⛓ O1
- [ ] **P2.6** W5 suite extension — unit tests for every new pure translation/weather
  function 🧪 (must ship with P2.1–P2.5, not after)

**Gate G2:** owner A/B-accepts V1 · H1/H2/H4 live on prod · bun test/lint/build green ·
determinism invariants intact (W5). Owner confirmation in chat required → then P3.

### P3 — Share loop & identity completion
- [ ] **P3.1** Rivalry-tag input on Death Card (CC-PLAN D9 leftover) ⛓ none
- [ ] **P3.2** Candle-rain mutation variant (CC-PLAN D9 leftover) ⛓ none
- [ ] **P3.3** 🔒 **O6** Real-device mobile QA pass (E10) — REQUIRED before any launch
  announcement
- [ ] **P3.4** 🔒 **O5** Mascot V2 re-brief (owner brief → identity doc → assets; E6)

**Gate G3:** rivalry tag + candle-rain live 🧪 · one clean real-device session ·
mascot assets merged (if O5 delivered) → owner confirmation → P4.

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

## 4. Gate ledger

| Gate | Phase | Status |
|---|---|---|
| G1 | P1 | ✅ PASS 2026-09-30 (owner-confirmed) |
| G2 | P2 | ⬜ pending |
| G3 | P3 | ⬜ pending |
| G4 | P4 | ⬜ pending |
| G5 | P5 | ⬜ pending |
| G6 | P6 | ⬜ pending |

## 5. Current pointer

> ▶ **NEXT ACTION: P2.1** — Visual V1 (translation grammar + parallax + juice) behind
> `?renderer=v2` feature flag, with P2.6 tests shipped together. No owner input needed.
