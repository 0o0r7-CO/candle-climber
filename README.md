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

## Status — M1 vertical slice (playable)

| Shipped | Next |
|---|---|
| Canvas 2D engine (fixed-timestep physics, coyote time, jump buffering, crumble timers) | Game-feel polish + combo scoring pass |
| Daily Seed: UTC date → symbol + window, deterministic level | Global leaderboard persistence (DB) |
| Real market data: Binance klines via server proxy + synthetic fallback | Death Card v2 (rivalry tags) |
| Death Card generator (1080×1350 PNG download / WebShare) | Daily chart mutations (candle rain, low gravity) |
| Global leaderboard API (in-memory) + top-10 board UI | Wallet identity + on-chain scores |
| vibe/vibe design language, WebAudio synth SFX, mobile touch controls | $WICK token phase (bonding curve), PvP duels, guild wars |

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
```

## Architecture

```
src/game/cc/
  types.ts      Candle, SeedInfo, RunResult — shared contracts
  rng.ts        hashString, mulberry32 — seeded daily PRNG
  level.ts      daily seed → symbol + window; candles → platforms
  engine.ts     fixed-timestep loop, physics, crumble timers, scoring
  render.ts     canvas renderer (vibe/vibe palette, particles, camera)
  deathcard.ts  offscreen-canvas 1080×1350 share card
  sound.ts      WebAudio synth SFX
src/app/api/candles/route.ts      GET seed + klines (Binance proxy, cached)
src/app/api/leaderboard/route.ts  GET top / POST entry (in-memory → DB)
src/components/cc/GameCanvas.tsx  client shell: canvas + HUD + modals
```

## Docs

- [`docs/CC-PLAN.md`](docs/CC-PLAN.md) — technical master plan (locked)
- [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md) — design spec: rules, scoring, virality loop
- [`docs/INFRASTRUCTURE.md`](docs/INFRASTRUCTURE.md) — zero-cost infra map (Student Pack)

## License

[MIT](LICENSE) — candles are not liable for your liquidation.
