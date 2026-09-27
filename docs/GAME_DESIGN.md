# GAME DESIGN — Candle Climber

> Pitch: **"The chart is the level."** Every run is a market. Every death is a meme.
> Target: vibe/vibe builder task — utility/vibecoded track (working MVP required).

## 1. Pillars

1. **Skill, not spend** — the leaderboard is earned by reflexes and route-reading.
2. **Same chart, everyone** — one Daily Seed (UTC date → symbol + window) means
   scores are globally comparable; every vibe/vibe token launch becomes a future level.
3. **Death is the content** — you fail more than you win, so failure is the shareable
   artifact: Death Cards turn every liquidation into an X/Twitter post.

## 2. Core loop (~90 seconds)

```
SEE the chart layout → CLIMB green candles → DODGE red candles
→ GREED for combo multipliers → GET LIQUIDATED → SHARE the Death Card
→ "one more run" (same daily seed, or endless mode)
```

## 3. Rules (current M1 physics)

| Element | Behavior | Rationale |
|---|---|---|
| Green candle (bullish body) | Solid jump pad, full bounce | Safe ground = momentum |
| Red candle (bearish body) | Crumbles ~0.26 s after landing | "Don't catch falling knives" |
| Wick | Decorative — marks the candle | Chart authenticity |
| Combo | Consecutive green landings raise the multiplier | Greed = risk appetite |
| Fall below screen | **Liquidated** — run ends | Trading humor, hard fail state |
| Horizontal edges | Wrap-around | Keeps routes readable |

Movement quality gates: coyote time, jump buffering, jump cut, fixed-timestep
physics (60 Hz) — feel is prioritized over feature count (see CC-PLAN §7).

## 4. Scoring

- Base: candles passed.
- Multiplier: green-candle streaks (combo breaks on red or idle).
- Persistence: local best + global leaderboard (`POST /api/leaderboard`).
- Display: score chip in JetBrains Mono; death card shows score, symbol, date, rank.

## 5. Daily Seed spec

```
seed = hash(YYYY-MM-DD)                    → mulberry32 PRNG
symbol rotation table (crypto-first; stocks when a proxy ships)
window  = deterministic per date           → identical level worldwide
fallback= synthetic candle generator driven by the same seed (weekends/gaps)
```

## 6. Death Card (share loop)

- 1080×1350 PNG, generated offscreen at runtime: score, symbol, date, funny
  liquidation cause ("Your stop loss was decorative."), rank placeholder.
- Actions: Download / `navigator.share` (mobile) — no login, no friction.
- Phase p2: **Rivalry Tag** — optionally stamp a rival's X handle; the mockery
  card pulls their audience in.

## 7. Roadmap (14-day arc, from CC-PLAN §6)

- **D1–3 ✅** core engine + real candles + daily seed (M1 slice)
- **D4–7** leaderboard DB (Atlas M0) + deploy (Vercel) + death-card polish + showcase GIF
- **D8–9** daily mutations (candle rain, low gravity), rivalry tags
- **D10** $WICK token via vibe/vibe bonding curve — in-game currency & daily prizes
- **D11–12** Guild War weekend (guild vs guild aggregate scores)
- **D14** mainnet sync (on-chain high scores when mainnet ships)

## 8. Web3 layer (per tokenomics strategy)

- One game token via bonding curve — feeds both the utility (1.5%) and trader (1.75%)
  reward tracks of the builder task. No multi-launches.
- Anti-sybil: no self-play reward loops; wagered PvP only via two-party escrow
  with unique match IDs (p3); scores on-chain at mainnet.
- No PFP collection — skill-earned trophy NFTs only.

## 9. Art direction (locked, from vibevibe.fun reverse-engineering)

- Palette: bg `#101214`, card `#16191C`, hairline `#24282C`, brand lime `#CCFF00`,
  up-green `#5BD08A`, down-coral `#E07856` (never pure red), accent purple `#6A63C8`.
- Type: Clash Display (display) · JetBrains Mono (numbers) · Instrument Sans (UI).
- Character: "Wick" — our own chunky blockbot with glowing lime square glasses.
  Platform character language respected, zero IP copying.
- Audio: WebAudio synth (blips, crumbles, liquidation sting) — zero assets.
