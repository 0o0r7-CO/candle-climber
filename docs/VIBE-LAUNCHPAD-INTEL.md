# VIBE LAUNCHPAD INTEL — ground truth for $WICK launch (P4)

> Side-task byproduct (2026-09-30). Source: live headless-browser trace of `testnet.vibevibe.fun/create`
> + on-chain verification via testnet Blockscout. Full raw log kept OUT of this repo
> (`/home/z/my-project/download/vibe-data-collection-report.md` — not committed).

## Facts that affect P4 (our launch)

1. **Quote-asset roster has THREE distinct layers — do not trust the wizard UI:**
   - **Server-registered** (`GET /api/v1/chains/46630/config` → `quoteAssets`): exactly ONE — `SPCX` `0x5a5398155d98374c0e26265ea3cb9818169c2739` (on-chain name "Seedify Mock Stock SPCX", 1308 holders, registered at block 115095034). It is also the ONLY quote with a USD rate (`market/quote-usd-rates` → $161.95 via V4 conversion pool).
   - **Wizard UI tabs** are rendered from a **static catalog compiled into the client** (`static-v2/domain-shared-CfPNTQPi.js`, `v6Graphs.run15`, chainId 46630): NVDA `0x3ab0…03F0`, SPCX `0xba16…5Ac9`, AAPL `0x4388…AcF2` (stocks); OPENAI `0x1b14…1A5F`, ANTHROPIC `0x92dC…868C` (preipo); USDG `0x1021…3264` (currencies, 6 dec). All named "…(vibe/vibe test stock/asset, no value)" — vibe's own mocks, NOT Robinhood Stock Tokens.
   - **vibe/vibe tab** also lists address-known launch tokens (VIBEVIBE + unverified VBR/FUCKBASE with scam-warning tooltips).
2. **Selecting NVDA/AAPL in the wizard succeeds client-side with zero validation** (identical UI behavior to SPCX; only Multicall3 RPC reads, no REST check against `quoteAssets`). Submission-time acceptance is unverified (needs wallet signing) — but the strongest empirical signal: **1200/1200 most recent launches used ETH** (`quoteAssetAddress 0x0`), and no non-ETH launch was found.
3. **ETH is the only battle-tested pairing route** ("The direct route" — no routing through another asset's pool). Stock/preipo/currency pairs all route ETH through the quote asset's v4 pool in the same tx (extra hop, extra failure surface, no USD pricing outside SPCX).
4. **Contract sets: the client's static `run15` deployment ≠ config API `deployments`.** run15: factory `0xe7942178…Fea0`, zap `0x2784448c…AcEB1`, hook `0xA5E27E3E…2e8EC`, locker `0x7771E607…49c0`, buyback `0xC58D6B65…110A`, pairPolicy `0x48CFA6c8…2cc84`, poolManager `0x8366a39C…951`, giftLists `0xb78F181A…d88Be`, `referenceTargetWei 4e18`, deployBlock 123503237. Config: factory `0x40f1be6f…DF59`, feeHook `0x2779651f…d0Cc`, same poolManager. Our launch review screen should be cross-checked against the CURRENT config values at launch time.
5. **Economics confirmed twice** (config `policyVersion seedify-curve-v3-testnet-5eth-2pct-3pct-creator-125bps-75-25` + ToS text): V3 curve fee 1.25% = 75% creator / 25% protocol, each side split 50% claim + 50% buyback; net graduation target 5 ETH; 2% wallet cap; transfers locked until graduation; total supply 1e9 (curve 793.1M / LP 206.9M); creation fee 0.0005 ETH (launchFeeBaseUnits 8274037443990973 ≈ 0.00827… ETH for SPCX-quoted, vs ETH-quoted uses its own params — verify in wizard step 2 at launch time).
6. **Robinhood faucet (5 tokens: TSLA/AMZN/PLTR/NFLX/AMD) is completely disjoint from the vibe wizard.** Those five are Robinhood-canonical testnet tokens (holders 222k–290k each, verified on-chain); none is pairable on vibe. The faucet UI itself is Vercel-bot-walled (Code 21) — token list must be taken from on-chain/Blockscout, not the UI.
7. **Best official testnet token-discovery endpoint:** `https://explorer.testnet.chain.robinhood.com/api/v2/tokens` (Blockscout v2, unauthenticated). Robinhood's `api.robinhood.com/rhj/assets` is mainnet-only (195 assets, all chainId 4663); docs.robinhood.com has no testnet section.
8. **/create is gated by a User Agreement modal** (operator SPARK LABS ORGANIZATION, S.A.; version `2026-08-29-v2-v3`, persisted in `localStorage.seedify-legal-acceptance`). Draft state persists in `v6-create-draft-app-1` (pair default `0x0` = ETH). O3 (owner-signed launch) will hit this gate first — expect it, don't debug it.

## Decision-relevant conclusion for $WICK (recorded, not re-litigated)

Keep the P4 plan on **ETH pairing** (default, direct route, only route with real usage). SPCX-pairing is the only *registered* alternative if we ever want a stock-denominated experiment; NVDA/AAPL are UI-only decoys until server-registered. No change to W1/W5 anti-cheat or checklist order.

## Re-verification pointers (if anything changes before launch)

- `curl -s https://testnet.vibevibe.fun/api/v1/chains/46630/config | jq '.data.quoteAssets'`
- `curl -s https://testnet.vibevibe.fun/api/v1/chains/46630/market/quote-usd-rates`
- `curl -s "https://explorer.testnet.chain.robinhood.com/api/v2/tokens/<address>"`
