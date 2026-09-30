# GROWTH & HOOKS STRATEGY — the daily-return engine and the $WICK demand loop

> Written 2026-09-30. Companion docs: TOKEN-LAUNCHPAD-RESEARCH.md (platform facts),
> ART-DIRECTION.md (visual layer). Chat language FA · Doc language EN.
> Status: direction approved by owner after an explicit rejection of a first, generic
> hook map (kept in §5 for history, so nobody re-proposes it).

## 1. Goal and hard constraints (from verified platform mechanics)

Goal: reach 5-ETH graduation on genuine demand, then convert graduation into a durable
economy. Constraints that shape every design decision below:

| Constraint | Consequence for design |
|---|---|
| Meter = **net ETH accumulated in the curve** (buys − sells), not volume | The loop must produce NEW ETH buys and suppress sell pressure |
| Wallet cap 2% of supply (`curveWalletCapBps 200`) | Whales cannot graduate a token; breadth is mandatory → design for many daily players, not spenders |
| `transfersLockedUntilGraduation = true` | Pre-grad: NO token movement possible. Buy-from-curve + hold are the only actions. Balance-gating works; spending/burning does not |
| Anti-abuse (self-trading, sybil, spam-filter) | Fake volume is a disqualifier; our W1 run-token + W5 anti-cheat is a genuine asset here |
| Testnet items are worthless; rewards discretionary ("nothing guaranteed") | No real-money gambling texture pre-TGE; no guaranteed-reward promises anywhere in UI/copy |

## 2. The core growth loop

```
daily-return hook (H1–H5 below)
   → player wants today's run / higher tier / today's reveal
   → buys $WICK from the curve (ETH enters the meter)
   → streak/weight system makes selling self-harm (reserve stays)
   → 2% cap ⇒ only MORE PLAYERS move the meter ⇒ referrals
   → visible public progress bar on the token page = collective climb
   → graduation: Merkle airdrop board auto-delivers to the community
   → post-grad economy: in-game spend/burn, treasury-funded tournaments
   → creator fee: 50% payout + 50% $WICK buyback-to-burn (deflation narrative)
```

The pre-graduation token mechanic is the **Balance Gate** (§3). The post-graduation
mechanics unlock with transfers (§4).

## 3. Balance Gate (pre-graduation token hook — the only one that CAN work)

- Player connects wallet in-game; **server reads on-chain $WICK balance** (read-only RPC —
  no transfers, no allowances, nothing that the transfer-lock blocks).
- Tiers gate run modes/cosmetics, e.g.: Base climb free · ≥ X $WICK unlocks "Summit tier"
  runs (higher score multiplier, better loot weights) · ≥ Y unlocks cosmetic trail.
- Wallet identity is ADDITIVE to W1 HMAC run-tokens — the run anti-forgery layer stays
  authoritative; the wallet only gates tiers and receives airdrop weights. W5 anti-cheat
  untouched.
- Honest fallback: if the wallet is not connected, everything remains playable — the gate
  buys advantage/content, never base access (keeps E8 zero-friction and avoids paywall
  optics for judges).

## 4. Post-graduation unlocks (transfers open)

- **In-game spend/burn:** run entries, revives, cosmetics, tournament tickets — burned or
  routed to treasury. Now legal because transfers are unlocked.
- **Treasury tournaments:** creator fee payout share funds recurring prize pools.
- **Buyback narrative:** every trade auto-buys-and-burns $WICK (fee rails) — the game can
  surface the live burn counter as a feature ("the game eats its own supply").
- **Mirror + Wick Vault** activate (H6/H7).

## 5. Rejected approach (do not re-propose)

The first hook map (streak + lootbox + bull/bear prediction + leaderboard pings) was
generic catalog gamification — mechanics any non-market game could ship. Owner rejected it
2026-09-30. The bar that replaced it: **"if a game that is not about markets could copy
this hook, discard it."** The psychological principles (variable reward, escalating stakes,
loss aversion, social proof, narrative mystery, asymmetric information) remain valid as
*science*; the expressions below are native to the game's identity.

## 6. The identity-native hook set

Raw material nobody else has: terrain = REAL market history · death data = real and
verifiable · the token's own chart is also a chart.

### H1 · ARCHIVE — "our levels are documentary, not designed"
- **Pitch:** climb market history's actual days — 2020-03-12 (COVID), 2021-05-19 (LUNA),
  2022-11-09 (FTX). Famous dates = famous difficulty nobody would dare design.
- **Mechanic:** the deterministic generator already takes (symbol, date) — add an era
  browser + difficulty auto-tagging (volatility of the day). Era-specific palettes (see
  ART-DIRECTION §4).
- **Psychology:** narrative stakes + honor badge ("I survived COVID day"). Effortless
  content depth: every historical day is a level forever.
- **Token tie:** Archive marathons feed airdrop weights. **Growth phase: G0** (no token needed).

### H2 · WEATHER — "you feel volatility with your hands"
- **Pitch:** candle statistics become physics: day ATR = wind (swaying terrain, particle
  streaks), volume = fog (reduced lookahead), gaps = tremors. Quiet day = dead calm air;
  crash day = storm.
- **Mechanic:** derived in the same pure translation layer from the same daily OHLC —
  deterministic, W5-safe.
- **Psychology:** body-learned market regimes (stealth education); daily novelty without
  random rewards — the market IS the variable reward schedule.
- **Token tie:** none needed — this is product depth that raises the utility-track case.
  **Phase: P0.**

### H3 · WRECKAGE — "the mountain is carpeted with yesterday's dead"
- **Pitch:** every death freezes a translucent ghost at its exact fall point, visible to
  all future climbers of that level. Clusters of corpses on one wick = honest danger map.
- **Mechanic:** death events (level date, x, height) already exist via the anti-cheat run
  pipeline; store per (symbol,date) in Mongo, render as cached sprites.
- **Psychology:** social proof + collective loss aversion + "see your own corpse tomorrow".
- **Token tie:** holders' ghosts could carry a subtle holder-aura (identity, not power).
  **Growth phase: G0** (needs board persistence = E9 Atlas unlock).

### H4 · DAILY REPORT — "every night, one episode"
- **Pitch:** auto-generated end-of-day narrative from real aggregate data: "2,341 climbers
  attacked TSLA Tuesday. Only 31 reached 80%. The community died 4,102 times at 14:00 UTC.
  Tomorrow's terrain is written by ETH." Cliffhanger by construction.
- **Mechanic:** pure aggregation over existing run/leaderboard data → daily card (reuse
  deathcard renderer) + X post. Zero new gameplay code.
- **Psychology:** narrative mystery (serial cliffhanger) + social proof; the daily
  return trigger for non-players too.
- **Token tie:** post-grad, the report gains the burn counter and meter progress lines.
  **Phase: P0.**

### H5 · ROUTE PREDICTION — "don't vote; draw your path"
- **Pitch:** on today's chart, draw the route you expect tomorrow; tomorrow your drawing
  is scored against the real candles. The community's overlaid expectations vs reality =
  sentiment visualization made of player lines.
- **Mechanic:** path-draw UI on the chart canvas, store normalized polylines, next-day
  scoring vs actual OHLC (deterministic). Commit-reveal unnecessary (drawings are public,
  data arrives tomorrow regardless).
- **Psychology:** asymmetric-information texture — "I can read the market" — the
  trading dopamine loop with zero monetary risk.
- **Token tie:** prediction accuracy = airdrop weight (holder-track participation).
  **Growth phase: G1** (can exist pre-launch but shines with weights).

### H6 · MIRROR — "your token's chart is a level"
- **Pitch:** after launch, $WICK's own price chart becomes a playable level. Pump = smooth
  ramp; dump = nightmare. The graduation candle becomes a permanent legendary level —
  "we climbed the mountain we made."
- **Mechanic:** `vibe-launch.ts` already derives terrain from launch metrics; extend to
  feed the $WICK token's own OHLC series into the same pipeline.
- **Psychology:** holders intrinsically return daily to play their own money's terrain —
  the only token on the launchpad whose chart is playable.
- **Token tie:** IS the token tie. **Growth phase: G2** (needs live token history).

### H7 · WICK VAULT (bonus) — "the highest wick holds a treasure"
- **Pitch:** each day's highest wick carries a vault visible to everyone; opening it
  requires holding $WICK (Balance Gate expressed as fiction, not a paywall).
- **Mechanic:** place a vault entity at the level's peak wick; server verifies balance
  tier on open; grants cosmetic/weight rewards.
- **Psychology:** aspirational verticality (the game's core verb) + holder identity.
- **Token tie:** direct. **Growth phase: G1** (launch day).

## 7. Growth phases (G0–G2) mapped to the canonical product phases in MASTER-CHECKLIST.md

> G0 items ship inside product phase P2 · G1 inside P4 · G2 inside P6. The canonical
> order, ticks and gates live in docs/MASTER-CHECKLIST.md — this section only maps.

| Phase | Contents | Depends on |
|---|---|---|
| **G0** (now — no token, no owner input) | H1 Archive browser · H2 Weather systems · H3 Wreckage · H4 Daily Report | nothing (H3 wants Atlas E9) |
| **G1** (launch day, W6) | Balance Gate tiers · H7 Wick Vault · airdrop-weight accounting (streaks, predictions, archive marathons) · #project-showcase post | $WICK live |
| **G2** (post-graduation) | H6 Mirror · in-game spend/burn · treasury tournaments · burn counter UI | graduation |

## 8. Red lines (honesty rules, non-negotiable)

1. Pre-TGE: all "stakes" are points/weights — never real value, never gambling mechanics
   with money-like framing.
2. Never promise rewards; the platform itself guarantees nothing.
3. Balance Gate buys content/advantage, never base access (E8 zero-friction survives).
4. All reward-weight accounting server-side and deterministic — W1/W5 anti-cheat is the
   backstop that makes our claim of "anti-sybil by design" true when weights exist.
5. Hooks must remain derivable from real market data — no hand-authored fake history.
