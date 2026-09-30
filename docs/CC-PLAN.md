# CANDLE CLIMBER — Technical Master Plan

> Status: CONCEPT LOCKED 2026-09-28 · Target: vibe/vibe builder task (utility/vibecoded track)
> Language: EN (project source of truth) · Chat: FA

## 1. Pitch
"The chart is the level." A vertical-scrolling skill platformer where the terrain is REAL
candlestick data. Green candles = solid jump pads, red candles = crumbling platforms.
One daily level = one real symbol's chart, identical for every player worldwide.
Every new token launched on vibe/vibe becomes a future level.

## 2. Locked Design System (from vibevibe.fun reverse-engineering)
- Colors: bg `#101214` / card `#16191C` / hairline `#24282C` / brand lime `#CCFF00` /
  up-green `#5BD08A` / down-coral `#E07856` / ink `#0E1400` / accent purple `#6A63C8`
- Type: Clash Display (display/HUD titles) · JetBrains Mono (scores/prices) · Instrument Sans (UI)
- Character language: chunky blockbot, big square glasses (lime glow), thick outlines — OUR OWN mascot ("Wick"), NOT a copy of vibe vibers
- Tone: trading-culture humor ("liquidated", "paperhanded"), no copying of platform IP

## 3. MVP Scope (vertical slice → shippable demo)
1. Canvas 2D engine: fixed-timestep physics, auto-scroll, jump (buffered + coyote), crumble
2. Candle data: Binance public klines via server proxy + daily seed symbol rotation + deterministic synthetic fallback
3. Daily seed: UTC date → hash → symbol+window; all players get identical level
4. Scoring: candles passed × combo (green streaks); best stored locally + global board
5. Death card generator: 1080×1350 PNG (score, symbol, cause, rank) → download/WebShare
6. Global leaderboard: name + score (env-gated MongoDB Atlas M0 → automatic in-memory
   fallback when DATABASE_URL unset; anti-cheat + rate limit built in)
7. Vibe/vibe visual language per §2; sounds: WebAudio synth (no assets)

Out of MVP (sequenced): wallet sign-in → token launch (bonding curve) → wagered PvP duels
(two-party escrow) → guild wars → onchain scores (mainnet).

## 4. Architecture
```
src/game/cc/
  types.ts      Candle, SeedInfo, GameState
  rng.ts        hashString, mulberry32 (seeded PRNG)
  level-source.ts  pluggable level feed: Binance klines today → platform launch-feed (D10)
  level.ts      daily seed → seed info; candles → platforms
  mutations.ts  daily mutation pool → physics modifiers (per-date, deterministic)
  engine.ts     fixed-timestep loop, physics, crumble timers, scoring, float texts
  render.ts     canvas renderer (vibe/vibe palette, particles, camera)
  deathcard.ts  offscreen-canvas share card (mutation stamp + rival line)
  sound.ts      WebAudio synth
src/app/api/candles/route.ts      GET seed+klines (Binance proxy, in-memory cache)
src/app/api/leaderboard/route.ts  GET top / POST entry (MongoStore | MemoryStore)
src/lib/leaderboard-store.ts      storage adapter: env-gated Atlas M0, memory fallback
src/components/cc/GameCanvas.tsx  client shell: canvas + HUD + modals
src/app/page.tsx                  mounts the game
```
Data contract: `GET /api/candles` → `{ symbol, interval, date, candles: Candle[] }`
Candle = `{ t, o, h, l, c }` (floats, o/h/l/c in normalized % units per level builder).

## 5. Infrastructure (zero direct cost — GitHub Student Pack compatible)
| Need | Choice | Cost | Phase |
|---|---|---|---|
| Repo/CI | GitHub (user token) | free | now |
| Hosting | Vercel Hobby (or Pack DigitalOcean credits) | free | p1 |
| Leaderboard DB/auth | MongoDB Atlas M0 (free tier; $50 Pack credits confirmed) | free | p1 — code ready, awaiting `DATABASE_URL` |
| Market data | Binance public API (no key) + Yahoo proxy (stocks) | free | now/p2 |
| Mobile wallet link | Reown/WalletConnect Cloud free projectId | free | p2 |
| Domain | Namecheap .me (Pack) | free (Pack) | p2 |
| Duel/match server | DO credits / Fly.io | free (Pack) | p3 |
| Error tracking | Sentry free tier | free | p2 |

Credentials requested from owner: GitHub token (delivered) → Vercel token (delivered,
deployed) → Atlas `DATABASE_URL` (pending, E9) → Reown projectId (later phases).
No paid services anywhere.

## 6. Milestones
- D1–3 (now): playable slice — engine + real BTC/ETH/SOL/DOGE candles + daily seed + death
- D4–7: leaderboard + death cards + polish + showcase GIF capture
  ✅ leaderboard v2 (env-gated Atlas M0 + memory fallback, anti-cheat, rate limit)
  ✅ game-feel pass: float score texts, slow-mo death, sfx wiring, persisted mute
  ✅ ready-screen TOP-3 + rival gap line + Death Card v2
  ⬜ Vercel deploy (owner browser login) + showcase GIF
- D8–9: daily mutations — ✅ 5-pool mutation system shipped; ⬜ candle-rain variant,
  ⬜ X-handle rivalry tag input
- D10+: token launch via vibevibe bonding curve; payouts to top-5 daily (testnet)
  → now fully specified: docs/TOKEN-LAUNCHPAD-RESEARCH.md (verified mechanics, 5-ETH
  graduation, W6 checklist) · docs/GROWTH-AND-HOOKS-STRATEGY.md (Balance Gate + identity-
  native hooks H1–H7, phases P0–P2) · docs/ART-DIRECTION.md (candle-to-world grammar,
  visual roadmap V1–V4)
- D11–14: duels prototype, guild rally, mainnet watch

## 7. Risks
- Physics feel → tune by D3, cut features not feel
- Data gaps (weekend stocks) → crypto-first watchlist; synthetic fallback identical across clients
- Anti-sybil → no reward loops tied to self-play; escrow duels only in p3
