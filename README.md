# CANDLE CLIMBER

> **The chart is the level.** A vertical skill platformer whose terrain is built from
> real candlestick data. Built for the **vibe builders** program on Robinhood Chain.

You are a small blocky trader running up a live chart. Green candles are solid
jump pads. Red candles crumble under your feet. Fall off the bottom of the screen
and you are — obviously — **liquidated**.

## Why it fits the ecosystem

- **Utility / vibecoded track** — ships a real, playable MVP (browser, desktop + mobile).
- **Every vibe/vibe launch is content** — one daily level = one real symbol's chart,
  identical for every player worldwide (deterministic daily seed).
- **Shareable death loop** — every run ends in an auto-generated, downloadable
  Death Card (score, symbol, funny liquidation cause, rank) built for X/Twitter.
- **Anti-sybil by design** — no reward loops tied to self-play; score = pure skill.

## Status — live at https://candle-climber.vercel.app

Real daily candles, real deaths. Deployed 2026-09-29 · CI green on `main` ·
QA: 450+ headless sim rounds + live desktop/mobile-emulated sessions, zero
exceptions (see `scripts/qa-sim.ts`, `docs/ECOSYSTEM_BAR.md`).

| Shipped | Next |
|---|---|
| Canvas 2D engine (fixed-timestep physics, coyote time, jump buffering, crumble timers) | Game-feel polish + combo scoring pass |
| Daily Seed: UTC date → symbol + window, deterministic level + daily mutations (5-pool) | Platform launch-feed levels (level-source → D10) |
| Real market data: Binance klines via server proxy + geo-fallback + synthetic fallback | Death Card v2 (rivalry tags) |
| OG/twitter cards, PWA manifest, metadataBase — share loop live | Global leaderboard persistence (Atlas `DATABASE_URL` — code is plug-and-play) |
| Death Card generator (1080×1350 PNG download / WebShare) | Wallet identity + on-chain scores |
| Global leaderboard API (memory fallback → MongoDB Atlas, env-gated) + boards | $WICK token phase (bonding curve), PvP duels, guild wars |
| market legibility stats (REAL MOVE %, difficulty), MiniChart, hint bubbles | Real-device mobile QA pass |
| vibe/vibe design language, WebAudio synth SFX, mobile touch controls | Mascot V2 (parked pending owner re-brief) |

## Tech stack

- **Next.js 16 (App Router) + TypeScript** — app shell, API routes
- **Canvas 2D** custom engine (`src/game/cc/`) — no heavy game frameworks
- **Tailwind CSS 4** — vibe/vibe palette (`#CCFF00` lime on `#101214`)
- **WebAudio** synthesized sound — zero audio assets
- **Bun** — package manager and runtime
- Zero-cost infrastructure mapped to the **GitHub Student Developer Pack**
  → see [`docs/INFRASTRUCTURE.md`](docs/INFRASTRUCTURE.md)

## Quickstart

```bash
bun install
bun run dev        # http://localhost:3000
bun run lint       # eslint
bun run build      # production build (Vercel-style)
```

Production runs on Vercel with `build` (plain `next build`); `build:standalone`
exists for self-hosted/`bun start` runs.

## Architecture

```
src/game/cc/
  types.ts      Candle, SeedInfo, RunResult — shared contracts
  rng.ts        hashString, mulberry32 — seeded daily PRNG
  level.ts      daily seed → symbol + window; candles → platforms
  mutations.ts  5-pool daily mutations → physics modifiers (deterministic)
  market.ts     legibility stats: REAL MOVE %, FRIENDLY/SPICY/BRUTAL
  level-source.ts  pluggable level feed: Binance today, platform launches tomorrow
  engine.ts     fixed-timestep loop, physics, crumble timers, scoring
  render.ts     canvas renderer (vibe/vibe palette, particles, camera)
  deathcard.ts  offscreen-canvas 1080×1350 share card
  sound.ts      WebAudio synth SFX
src/app/api/candles/route.ts      GET seed + klines (Binance proxy + geo-fallback, cached)
src/app/api/leaderboard/route.ts  GET top / POST entry (memory fallback → MongoDB Atlas when DATABASE_URL set)
src/lib/leaderboard-store.ts      storage adapter: env-gated Atlas M0, memoized clients
src/components/cc/GameCanvas.tsx  client shell: canvas + HUD + modals
```

## Docs

- [`docs/CC-PLAN.md`](docs/CC-PLAN.md) — technical master plan (locked)
- [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md) — design spec: rules, scoring, virality loop
- [`docs/ECOSYSTEM_BAR.md`](docs/ECOSYSTEM_BAR.md) — honest scoreboard vs the vibe/vibe ecosystem bar (E1–E10)
- [`docs/INFRASTRUCTURE.md`](docs/INFRASTRUCTURE.md) — zero-cost infra map (Student Pack)

## License

[MIT](LICENSE) — candles are not liable for your liquidation.
