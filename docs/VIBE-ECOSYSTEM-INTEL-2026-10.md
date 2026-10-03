# VIBE ECOSYSTEM INTEL — founder, Sparkswarm, Robinhood Chain ground truth (2026-10-03)

> Commissioned by owner: "go to the Twitter of the founder and the technical team of the Vibe
> ecosystem … review their latest posts and tags … they posted projects they considered really
> good … their GitHub address is in a screenshot … do deep and extensive research … add to the
> project knowledge … then see whether we need changes to our strategy, especially economics and
> monetization."
>
> Method: GitHub API (profile/repos/events), live site fetches (agent.sparkswarm.ai, sparkswarm.ai,
> vibevibe.fun, fomoradar.app), live config API re-read, raw README/doc pulls from the founder's
> repos, 8 search passes. Everything below is source-linked. Items that could NOT be verified from
> this sandbox are marked **[unverified — need owner input]**; X itself blocks every access channel
> from this network (details §6).

---

## 1. Identity map — who actually runs the ecosystem

| Surface | Handle | Evidence |
|---|---|---|
| X (personal) | **@meta_alchemist** | og:description bio: "vibes @vibevibefun @spark_coded" |
| GitHub (personal) | **github.com/Vibeforge1111** | GitHub `name: meta_alchemist`, `twitter_username: meta_alchemist`, bio: "vibes at vibevibe.fun & spark_coded" |
| Platform X | **@vibevibefun** | referenced in both bios |
| Spark X | **@spark_coded** | referenced in both bios |
| Account age | GitHub created **2025-08-02**; 56 public repos; 286 followers; follows 11 | GitHub API |

One person is founder/technical team of **both halves** of the ecosystem: the vibe/vibe launchpad
(crypto) and Sparkswarm (AI-agent product company). There is no visible separate "team" account;
@vibevibefun / @spark_coded are the product accounts. **[The screenshot GitHub = Vibeforge1111,
confirmed by owner; profile matches the founder exactly.]**

## 2. The two-product empire

### 2a. Spark / Sparkswarm — the AI half (this is where his monetization is proven)

- **Spark** (agent.sparkswarm.ai): "recursive self-improving personal AI agent — trains itself
  24/7 in gyms, against real benchmarks, through domain chips you install."
  Pricing from the site's own schema.org JSON-LD: **Spark Free $0** + **Spark Pro $19.99/month**.
  Features: recursive loop (gather→reason→score→learn→compound), persistent memory, writes its own
  tools, domain chips, local-first, bring-your-own-LLM, open `spark.toml`.
  Site hero admits it studies social distribution: last autonomous run shown on the page is
  `promoting /xcontent-virality benchmark passed +0.4 · thread_score_v3 tool kept after 12 evals ·
  memory launch strategy salience raised`. **They literally train their agent to be better at X
  virality and launch strategy.** Expect their launch posts to be optimized, not casual.
- **Spark Swarm** (sparkswarm.ai): "hosted, GitHub-native private beta … connect a repo, publish
  through GitHub checks … network-visible proof … provenance builds a verified record of expertise
  that compounds." Evolution loop: Discover → Absorb → Evolve → Share.
- **Infrastructure repos**: `spark-harness-core` (authority kernel: "model proposes → Governor
  decides → lifecycle executes → ledger records → evolution improves from evidence"),
  `spark-cli`, `spark-researcher` (22⭐), `spark-character`, `spark-telegram-bot`, `spark-voice-comms`,
  `spark-domain-chip-labs` (22⭐), `spark-intelligence-builder`, `Spark-Agent-Site`.
- **Builder-audience reach** (their distribution moat): `keep-codex-fast` **1584⭐**,
  `vibeship-spawner-skills` **885⭐**, `dexscreener-cli-mcp-tool` **248⭐**, `vibeship-scanner`
  **129⭐** ("2000+ rulesets, free vulnerability scanner for vibe coders"),
  `vibeship-suparalph` (101⭐), `codex-visual-builder-guild` (46⭐), `Codex-Autorouter` (10⭐,
  private beta; routes GPT-5.6 model/effort/subagents for Codex), `desk-of-best-traders`
  (11 legendary traders as analytical lenses), `seedify-agents-dashboard` ("evidence-grounded
  Launchpad research" — note **Seedify**: the launchpad stack is Seedify's, see §4).
- Takeaway: the founder's pattern is **free tool → stars → audience → productized subscription**.
  vibe/vibe is the crypto launchpad arm of the same playbook: give builders free rails, curate
  what's good, monetize the flow.

### 2b. vibe/vibe — our launch surface (config re-verified today, 2026-10-03)

- `GET /api/v1/chains/46630/config` → `policyVersion: seedify-curve-v3-testnet-5eth-2pct-3pct-creator-125bps-75-25`
  — **identical to the policy we recorded 2026-09-30** (VIBE-LAUNCHPAD-INTEL.md §4). No economic
  drift. Fields now nested under `.data.protocol` (schema moved — our launch-pack re-verify
  one-liner has been fixed to match; values unchanged).
- Live config confirms: curve fee **125 bps (1.25%)** split **creator 75% / protocol 25%**;
  creator share split **50% payout / 50% launch-token buyback**; protocol share split 50% treasury
  / 50% tSFUND buyback; buyback disposition **irrecoverable-burn-address**; graduation 5 ETH;
  wallet cap 2%; creator initial buy cap 3%; **transfers locked until graduation**; supply 1e9
  (curve 793.1M / LP 206.9M); creation fee 0.0005 ETH; factory `0x40f1…DF59` unchanged.
- **Launch pace: quiet.** The 25 most recent launches are all dated 2026-09-29 (launchIds
  141926–141987). Either the testnet has slowed or curation is happening off-surface. Nothing has
  graduated on the status endpoint I probed. **[worth re-checking at signing]**
- Brand: vibevibe.fun ships its OG banner "founder's banner (2026-09-29)" and self-hosted fonts
  named **"Spark Loops"** — the launchpad and Sparkswarm share one design language. The ecosystem
  presents as one studio, not two companies.

## 3. Robinhood Chain ground truth (from the founder's own radar repo — highest-value doc)

He forked `cvxv666/fomo-robinhood-radar` as `rr` (2026-09-12) — a full on-chain surveillance stack
for our chain. Its `docs/robinhood-chain.md` ("what chain 4663 actually looks like, measured",
Sept 2026) and README give us facts no official doc states:

| Fact | Value / consequence for us |
|---|---|
| **Mainnet is live** | chain id **4663** (`0x1237`), RPC `rpc.mainnet.chain.robinhood.com` — our Sep-29 note "4663 disabled per legal terms" applied to the launchpad/testnet surface; the consumer economy now runs on mainnet |
| Block time | ~0.1008 s (~10 blocks/s), ~470 ERC-20 Transfer logs/s |
| fomo.family | consumer trading app ON mainnet 4663: leaderboard, PnL (includes open bags), verified wallets, trader notes; API sold via fomoapi.io |
| **Relayer model** | a relayer submits every trade — **the trader's wallet is never the tx `from`**; all fills route through router `0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f`; token router→wallet = buy, wallet→router = sell; exactly one fill per tx |
| USDG | Robinhood Chain's dollar stablecoin; every trade passes through it (quote-asset noise in naive feeds) |
| robinhoodtrenches.com | curates ~108 "trenches" wallets; free, keyless |
| fomoradar.app | LIVE site + TG bot (@fomoradarRH_bot) + HTTP API + "pro" + webhooks: signals, **Fresh** (first trusted buys), exits, leaderboard ranked by AI-judged "conviction" = Σ(score/100)² per holder — *whose* money, not how many wallets |
| **DexScreener does NOT cover the chain** | measured 2026-09-08: knew 3 of 30 held tokens, priced none. **GeckoTerminal DOES index it** (OHLCV + pools) |
| Provenance spoofing | anyone can push tokens into famous wallets to fake "buying"; receipt-based provenance is required (1 in 11 credited buys was fake in a re-checked week) |
| RPC quirks | rejects default httpx UA (403); 429s on bursts; `eth_getLogs` ~200k blocks/query; topic arrays + JSON-RPC batching work |

## 4. Seedify connection

policyVersion prefix `seedify-curve-v3`, protocol fee buys back **tSFUND ("Testnet SFUND")**, and
the founder maintains a `seedify-agents-dashboard`. The launchpad is built on Seedify's curve/fee
stack. Why it matters: Seedify has an established launch/airdrop culture — third-party guides
already write "how to qualify" content for it (search hit: *"vibe/vibe Airdrop Guide: How to
Qualify for the 5% Allocation"*, usethebitcoin.com, Sep 21 2026 **[article page 404s on direct
fetch; headline verified via search index only]**). An airdrop-expectation narrative already
surrounds this platform whether we participate or not.

## 5. What the promoted projects likely are **[unverified — need owner's links]**

X post texts are inaccessible from this sandbox (see §6). What we hold:

- Five recent post IDs with timestamps (from the profile shell):
  `2104844492893564986` (Sep 29 08:03), `2105720503201841360` (Oct 1 18:04),
  `2105908667388440685` (Oct 2 06:32), `2106109180788736247` (Oct 2 19:48),
  `2106258726588211354` (Oct 3 05:43 — the morning of this session).
- The owner reports: several posts promoting projects they "considered really good", a post whose
  screenshot contains the GitHub address (= Vibeforge1111, confirmed), and profile-page links the
  owner has copied and will send.
- From GitHub alone, the projects the founder invests his own time in (and would plausibly
  spotlight) map to two families: **Spark-ecosystem builder tooling** (§2a) and **Robinhood Chain
  trading/curiation surfaces** (§3: fomo radar, trenches, dexscreener tooling). Both are
  "Product & Utility with real users" — the same category he launched the platform around.

## 6. X access attempt log (so the next session doesn't redo it)

Blocked from this sandbox: direct x.com (login wall; profile shell gave bio + 5 status IDs only),
`syndication.twitter.com` (empty), `publish.twitter.com/oembed` (empty), `r.jina.ai` (403
AbuseAlleviation on all of x.com), nitter mirrors (dead: xcancel 2 KB stub, poast/privacydev
unreachable), headless Chromium via agent-browser (0.38.1 — "Access to x.com was denied",
datacenter-IP block). **Remaining channel: owner pastes the links/texts he is already copying.**

## 7. Strategy implications — economics & monetization of Candle Climber / $WICK

### 7a. Economics: KEEP the launch config; the platform now works harder for us
- The 2% creator tax plan (holders 75 / treasury 20 / burn 5, ETH reflections 0) **stands**. The
  DRGN ground truth in TOKEN-LAUNCHPAD-RESEARCH §7 remains the ecosystem's reference split.
- What changed in our favor: the **base rails are now confirmed from live config** — every trade
  pays 1.25% curve fee, of which the creator's 75% is half ETH payout and half
  **automatic buyback of $WICK into an irrecoverable burn address**. Our EXTENDED description line
  "every trade already buyback-burns $WICK automatically via the platform's fee rails" is no
  longer narrative — it is protocol-level fact (feeHook `0x2779…d0Cc`). Keep the copy exactly as
  written in WICK-LAUNCH-FORM-PACK.
- Monetization without cynicism: pre-graduation we earn the creator fee share by default; our own
  2% tax adds the holder-alignment layer. Treasury (20%) stays earmarked for tournaments — that
  is the monetization story that fits the founder's "Product & Utility, real users" curation
  taste. **No config changes recommended.**

### 7b. Distribution: be where the chain's liquidity actually looks
- After launch: **list/claim $WICK on GeckoTerminal** (pools + OHLCV are indexed there). Do not
  interpret DexScreener silence as failure — it does not cover this chain yet (measured by the
  founder's own repo). Re-check DexScreener coverage weekly; when it lands, submit immediately.
- The demand cohort that exists TODAY on this ecosystem is fomo.family's mainnet traders, watched
  by fomoradar's "Fresh"/"Signals" feeds and the 108 trenches wallets. Post-graduation (when
  transfers unlock), holder-quality is the currency — fomoradar's conviction metric literally
  ranks by *whose* money is in a token, which matches our holders-heavy reflections design. Plan
  post-grad outreach at that time; pre-grad, nothing to do (transfers locked, and radar feeds
  filter locked-supply tokens out naturally).
- The airdrop-expectation narrative (Seedify culture + "5% allocation" guides) is free demand for
  us IF our story is legible: publish the **weights story** (streak / route prediction / archive
  marathon → airdrop weights, ~10% community share via P4.4 + treasury) in the showcase post so
  qualification-hunting players land on OUR game as the honest way to qualify. We still skip the
  Merkle gift list at launch (no real wallets exist yet — Balance Gate P4.2 ships first).

### 7c. Positioning: mirror the founder's curation taste
- The founder's own promotion pattern (from GitHub evidence) favors **shipped, tool-real,
  user-real products with proof-of-work**: live sites, measured docs, honest limitations,
  provenance, anti-spoof. Candle Climber's evidence pack (450+ headless QA rounds, real-device QA,
  HMAC anti-cheat, server-verified scores, honest testnet framing) is exactly this genre. The
  #project-showcase template in WICK-LAUNCH-FORM-PACK already speaks that language; when the
  owner supplies the promoted posts' actual tags, mirror those tags verbatim on our launch post.
- The Spark side shows the ecosystem's meta-game: they optimize posts for virality deliberately
  (§2a). Practical response: our launch-day post should be ONE strong thread (game playable
  free → $WICK utility → Death Card share loop), not scattered replies; and the founder's
  criteria-visible words ("live", "playable", "measured", "provenance", "no value promises") are
  the dialect to use.

### 7d. Watchlist (next 2–6 weeks)
1. **Mainnet launchpad migration** — mainnet 4663 is live for fomo; the launchpad is testnet-only
   today. Ask in the builders channel / showcase post replies when vibe/vibe graduates to mainnet;
   if a migration path exists at graduation, our treasury/liquidity plans should assume it.
2. **@vibevibefun + @spark_coded** accounts (not only the founder's personal) — they are the
   resharing surfaces for "projects considered really good".
3. **Launches resuming after the Sep-29 quiet** — if curation is happening, early post-quiet
   launches may get disproportionate spotlight; being early on a fresh surface helps.
4. **Spark Swarm beta openings** — the founder's distribution machine; once our X account exists,
   one good provenance-rich post about Candle Climber's QA evidence is the kind of content his
   network amplifies.

### 7e. Needed from owner (blocks nothing above)
1. The profile-page links he copied → I will fold them into §5 and re-run the strategy pass.
2. Names/links of the promoted projects + the tags used on those posts.
3. Confirmation (already 95% done) that the screenshot's GitHub = Vibeforge1111.

## 8. Evidence register

| Claim | Source | Fetched |
|---|---|---|
| Identity map | GitHub API `/users/Vibeforge1111`; x.com og:description | 2026-10-03 |
| Repo stars/descriptions | GitHub API `/users/Vibeforge1111/repos` | 2026-10-03 |
| Spark pricing/features | agent.sparkswarm.ai JSON-LD (`offers` $0/$19.99) | 2026-10-03 |
| Swarm beta model | sparkswarm.ai landing copy | 2026-10-03 |
| Harness kernel | raw README `spark-harness-core` | 2026-10-03 |
| Chain 4663 mainnet, relayer, router, USDG, gecko-vs-dex, provenance | raw `rr/docs/robinhood-chain.md` + `rr/README.md` (fork of cvxv666/fomo-robinhood-radar) | 2026-10-03 |
| fomoradar live surfaces | fomoradar.app homepage | 2026-10-03 |
| Policy v3 config unchanged | `GET testnet.vibevibe.fun/api/v1/chains/46630/config` | 2026-10-03 |
| Launches quiet since Sep 29 | `GET …/launches?limit=25` | 2026-10-03 |
| Founder banner 2026-09-29, "Spark Loops" fonts | vibevibe.fun HTML head comments | 2026-10-03 |
| 5 recent post IDs/timestamps | x.com profile shell + snowflake decode | 2026-10-03 |
| "5% Allocation" airdrop guide exists | search index snippet (usethebitcoin.com, Sep 21) — page not fetched | 2026-10-03 |
