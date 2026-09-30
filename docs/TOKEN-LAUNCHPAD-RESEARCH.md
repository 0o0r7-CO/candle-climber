# TOKEN LAUNCHPAD RESEARCH — vibe/vibe on Robinhood Chain Testnet

> Written 2026-09-30. Evidence-based; every claim below was verified live (site API,
> chain RPC, explorer) on 2026-09-29/30. Raw evidence register with full payloads lives in
> `research-cache/vibevibe-launchpad-research.md` (gitignored); this doc is the
> self-contained repo copy of everything that matters.
> Working token symbol: **$WICK** (per README / CC-PLAN; launch wizard ticker must match ≤16 chars).
> Chat language FA · Doc language EN (project source of truth).

## 1. VERDICT — launch via the vibe/vibe launchpad, NOT a custom contract deploy

Custom deployment on Robinhood Chain testnet IS technically possible (permissionless EVM —
we have done it before for a prior product). But it bypasses everything that makes a token
an *ecosystem* token:

| What the launchpad gives | What a custom deploy gives up |
|---|---|
| Site listing (Discover tabs: Trending / Final stretch / New / Graduated / Top movers) | Invisible unless you build your own UI |
| Bonding curve with built-in price discovery | You write and audit your own curve |
| Automatic graduation → Uniswap v4 pool + locked liquidity | You build liquidity migration + locker yourself |
| Creator fee rails (payout + buyback-to-burn), optional tax/reflections | You implement fee machinery yourself |
| Gift/airdrop board (Merkle, auto-delivered at graduation) | You build distribution yourself |
| Leaderboards / Guilds / #project-showcase distribution + testnet rewards program (5% of future supply, discretionary) | None of it |

Four independent source classes agree: config API policy, Discord official channels,
legal terms, on-chain tx shapes. "Launching on vibevibe testnet is the normal project
intake path" (#testnet-incentives).

## 2. Chain identity (verified, not assumed)

- RPC: `https://rpc.testnet.chain.robinhood.com` → `eth_chainId = 0xb626` (46630)
- Explorer: `https://explorer.testnet.chain.robinhood.com` (Blockscout-style v2 API works)
- **"testnet.vibevibe" is the site DOMAIN, not a chain.** All on-chain activity is Robinhood
  Chain Testnet 46630. Chain ID 4663 is disabled per legal terms. No mainnet exists —
  `vibevibe.fun` redirects to `testnet.vibevibe.fun`.

## 3. Launch mechanics (the wizard at /create — 4 steps)

1. **TOKEN** — logo REQUIRED · name ≤64 · ticker ≤16 (`$` prefix) · pair tabs:
   Classic (native ETH, "direct route") / vibe-vibe (VIBEVIBE quote) / Stocks&ETFs (NVDA,
   SPCX, AAPL) / Pre-IPO (OPENAI, ANTHROPIC) / Currencies (USDG) · project types:
   Meme&Artcoins / **Product&Utility** / RWA&Stocks · optionals: description, website, X, TG,
   Discord. "All of it is fixed once it is live."
2. **TAX** — 1% / 2% / 3% total · platform takes 20% of it (buys platform token → half to
   holders, half burned) · creator gets 80% freely split across: treasury / ETH reflections /
   token reflections / burn · presets (Balanced, Holders first, Real yield, Builder,
   Deflation) · 20s anti-snipe opening tax.
3. **BUY** — creator opening buy None/1/2/3%/custom · creation fee note shows 0.0004 ETH
   (config says 0.0005 — on-chain math confirmed 0.0005) · you + airdrops ≤ 50% supply.
4. **AIRDROPS** — optional Merkle gift lists, paid at launch, **locked until graduation**,
   auto-delivered on graduation day; never graduate → locked forever.

Flow: creator sends ONE tx to the router; the factory deploys token + curve in-tx. Verified
on two real launch txs (see §8). Launch minimum (Discord #how-to-launch): "MVP, demo,
prototype, or usable flow" — Candle Climber is live and playable, exceeds the bar.

## 4. Curve economics (GET /api/v1/chains/46630/config — policy
`seedify-curve-v3-testnet-5eth-2pct-3pct-creator-125bps-75-25`)

| Parameter | Value |
|---|---|
| totalSupply | 1,000,000,000 (18 dp) |
| curveAlloc / lpAlloc | 793.1M / 206.9M |
| netGraduationTargetWei | **5 ETH** (5e18) — ETH-pair launches |
| quoteAssets.netGraduationTargetBaseUnits | 82.74 base units (per-quote target for non-ETH pairs) |
| curveFeeBps | 125 (1.25%) → creator 75% / protocol 25% |
| creatorFees disposition | 50% payout + 50% launch-token buyback |
| protocolFees disposition | 50% treasury + 50% platform-token (tSFUND) buyback |
| buybackDisposition | **irrecoverable-burn-address** |
| creationFeeWei | 0.0005 ETH |
| curveWalletCapBps | 200 (**2% of supply per wallet** during curve phase) |
| creatorInitialBuyCapBps | 300 (3%) |
| transfersLockedUntilGraduation | **true** |

Deployments (46630): factory `0x40f1be6faf8DAB9C143cce1a0A04c2075Fb2DF59` (current gen;
legacy gens incl. `0xe7942178…559fea0`, `0xB5B7…`), graduationAdapter
`0xA6a5D4C098dA8f79eae1203A8E42ff9AC7a17F06`, feeHook `0x2779651f…f85d0Cc`,
liquidityLocker `0xc0a2DEEb…6074D`, Uniswap v4 PoolManager `0x8366a39c…40951`,
universalRouter/permit2/v4Quoter/multicall3, trading router `0x2784448c…cceb1`.
Platform token: tSFUND "Testnet SFUND" `0x728E…9b16`; VIBEVIBE
`0xf1f6…4c34` is a launched token used as quote asset.

## 5. Graduation — what the "5 ETH" actually is

- The 5 ETH is the **net accumulated quote currency in the curve** (buys minus sells —
  the `net` in `netGraduationTargetWei`). It is NOT total volume and NOT holder count:
  a token with 100 ETH total volume but offsetting buys/sells never graduates.
- **Structural consequence of the 2% wallet cap:** no single wallet can graduate a token.
  Graduation mathematically requires broad participation (dozens of distinct buyers at
  minimum). Fake volume is additionally filtered by the rewards program's anti-abuse
  (self-trading / sybil / spam-launch detection).
- **What happens to the ETH:** it does NOT go to the platform and does NOT disappear. At
  graduation the accumulated quote reserve + the 206.9M lpAlloc tokens migrate into a
  **Uniswap v4 pool** (liquidity locked via the locker) — it becomes the token's permanent
  exit liquidity. Transfers unlock. Live proof — VBL "Vibe Lens" graduated 2026-09-30
  03:40:46Z: pairUnits 36,921,315 VIBEVIBE (exactly its target) + tokenUnits 200M VBL →
  poolId `0x65f1…bbd2` on the PoolManager, tx `0x2769bcc0…95826c9`, block 126506275.
- **4 vs 5 ETH gotcha:** DRGN/FORGE (our earlier examples) show `targetPairUnits = 4 ETH`
  because they were launched via the LEGACY factory `0xe7942178…`. The CURRENT policy is
  5 ETH net. Non-ETH pairs have their own per-quote targets (82.74 units for VIBEVIBE-quote).
- Game-fit: the 5-ETH climb is already the game's SUMMIT narrative (W4 GRADUATED card) —
  token graduation = the community's shared mountain.

## 6. Burn & buyback — three layers, one critical constraint

1. **Curve fee (automatic, volume-proportional):** of the 1.25% fee, the creator's 75%
   splits 50% ETH payout / 50% buyback of the launch token → sent to the irrecoverable
   burn address. The protocol's 25% splits 50% treasury / 50% tSFUND buyback-and-burn.
2. **Creator tax weights (configured at launch):** the burn portion of the optional 1–3%
   tax (e.g. DRGN 5%, FORGE 13.01%) — collected on trades, executed by the feeHook.
3. **Platform tax:** 20% of the tax buys platform token → half holders, half burned.

**Critical constraint:** `transfersLockedUntilGraduation = true` means pre-graduation there
are NO transfers at all — users can only buy from / sell to the curve. Therefore
**user-initiated burns are impossible before graduation**, and no in-game mechanic can
custody player tokens pre-grad. All pre-grad burn is automatic and trade-proportional.
Burn reduces sell-side outflow (indirectly protects the meter) but does NOT fill it —
**only net buys fill the 5-ETH meter.**

## 7. Tax splits are fully creator-customizable (live proof)

| | DRGN "Cyber Dragons" (browser game) | FORGE "vibe forge" (3D tool) |
|---|---|---|
| token | `0x368E…247` | `0xDB52…423` |
| launch | id 247, factory `0xe7942178…`, native ETH pair | id 228, same factory, native ETH pair |
| tax | 2% | 1% |
| weights | treasury 20% / holders 75% / burn 5% | treasury 37.5% / holdersPair 49.49% / burn 13.01% |
| gifts | 10% supply reserved for 3,879 wallets | none |

Both are #project-showcase posts pairing a real product URL with the token page — the
exact template Candle Climber will use.

## 8. Evidence anchors (addresses / txs / blocks)

- DRGN launch tx `0xb9c9dd18…4ae2d70` (block 126302861), FORGE launch tx
  `0x09d3d22e…5549561d` (block 126279426) — creator EOA → router `0xe7942178…`, token
  deployed in-tx, FORGE value = 0.0126 opening buy + 0.0005 fee (confirms creationFeeWei).
- TREE curve-trade tx `0xd6ef22a2…c8eb5c5d` — buyer sent 0.003735 ETH directly to the
  curve contract (curve-phase trading = plain ETH transfers to curve).
- VBL graduation tx `0x2769bcc0…95826c9` → router `0x2784448c…` + PoolManager logs (§5).
- Legal: operator SPARK LABS ORGANIZATION, S.A. (Panama); testnet items worthless;
  "recognition of participation" = disclosure of intent, not a promise; rewards program
  allocates 5% of future mainnet supply (Traders 1.75% / Meme 1.50% / Utility 1.50% /
  legacy creators 0.25%) — discretionary, anti-abuse filtered, nothing guaranteed.

## 9. W6 execution checklist ($WICK launch — owner wallet actions)

1. Faucet test ETH on Robinhood Chain Testnet (zero real cost).
2. Wizard → category **Product & Utility**, pair **Classic / native ETH** (matches DRGN/FORGE
   and the "direct route" default), logo, description, socials (game URL + X).
3. Tax 2% with DRGN-style weights (holders-heavy) — treasury = prize pool, reflections =
   community reward, burn = deflation.
4. Creator opening buy: minimal or none; respect the 3% initial-buy cap narrative.
5. Airdrop board: reserve ~10% of supply (DRGN precedent) for leaderboard winners +
   streak/prediction weights — delivered automatically at graduation.
6. Launch tx = one signature. Post to #project-showcase: game URL + token URL + how-to-play.
7. Balance Gate tiers go live immediately after launch (see GROWTH-AND-HOOKS-STRATEGY.md §3).

Owner-dependent items: wallet signature (W6), X account (W7), Atlas `DATABASE_URL` (E9).
