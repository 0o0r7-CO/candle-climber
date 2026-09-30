# FEEDS — every data feed Candle Climber consumes

> Written by task 30-a (workstream W3). The ecosystem knowledge base requires that
> **every feed a product consumes is documented** — URL, interval, cost/licensing,
> determinism rule and failure mode (KB §9 req 3, carried into this repo's
> ecosystem docs: `docs/ECOSYSTEM_BAR.md`, "reconstruct the expectation factors"
> per CC-PLAN §1–2 / GAME_DESIGN §8–9). This page is that registry. When a feed is
> added, moved or re-keyed, update this file in the same commit.

## The determinism doctrine (applies to every feed)

- A level is pinned to a **UTC date**. The same date must yield a **byte-identical**
  response — any player, any client, any time that day (and its token stays valid
  through the following day, `src/lib/run-token.ts`).
- Therefore **only CLOSED candles shape terrain**. The in-progress candle/week is
  dropped at fetch time; open time of the next period is the cutoff.
- Every non-synthetic terrain is **server-vouched**: the response carries an HMAC
  `runToken` (payload = symbol+date+candle count+sha256 of the exact candle JSON).
  Synthetic fallback terrain is tokenless → runs on it are **unscored**.
- Server caches are keyed `` `${symbol}|${date}` `` (vibe-launch adds a `vibe:` +
  launchId prefix) with a 24h TTL; the cached entry stores the **source** so a
  cached synthetic never masquerades as live.

## Source labels in the UI (honesty rules)

| seed.source   | label        | scored? | data character                          |
|---------------|--------------|---------|-----------------------------------------|
| `binance`     | "live data"  | yes     | real Binance weekly OHLC                |
| `stooq`       | "live data"  | yes     | real stooq weekly OHLC (stocks)         |
| `vibe-launch` | "vibe launch"| yes     | **DERIVED** terrain from real launch metrics — never labeled "live" |
| `synthetic`   | "synthetic"  | no      | deterministic seeded fallback (tokenless)|

---

## 1. Binance klines — crypto daily levels

- **URL**: `https://api.binance.com/api/v3/klines?symbol=<SYM>&interval=1w&limit=220`,
  fallback host `https://data-api.binance.vision` (same path; official public
  market-data mirror that tolerates datacenter egress IPs).
- **Symbols**: `WATCHLIST` rotation (BTCUSDT, ETHUSDT, SOLUSDT, DOGEUSDT, XRPUSDT,
  BNBUSDT) or a deep link `/?symbol=<SYM>` honored when whitelisted.
- **Interval / shape**: 1w klines, array rows, index 6 = closeTime (ms).
- **Cost / license**: free, keyless, public market data (Binance terms apply).
- **Determinism**: drop rows with `closeTime > now` (only closed weekly candles);
  24h cache keyed symbol|UTC-date.
- **Failure mode**: geo-block HTTP 451 on the primary host (known for US-hosted
  serverless) → try the `.vision` mirror → still failing → **synthetic tokenless
  fallback** (source "synthetic", unscored). Client also has a full offline
  synthetic path in `GameCanvas` when the API itself is unreachable.

## 2. Stooq weekly CSV — stock rails (TSLA / AMZN / NFLX)

- **URL**: `https://stooq.com/q/d/l/?s=<lowercase>.us&i=w` — e.g.
  `https://stooq.com/q/d/l/?s=tsla.us&i=w`. Weekly rows, one per week.
- **Format**: CSV, header `Date,Open,High,Low,Close,Volume`, then one row per
  week. Parsed with plain string splitting (`route.ts` `fetchStooq`) — **no new
  dependencies**.
- **Mapping**: `Candle.t = Date.parse(rowDate + "T00:00:00Z")`; o/h/l/c are the
  row's numbers.
- **Cost / license**: free, keyless, zero cost. Public CSV download endpoint of
  stooq (personal/low-volume use; we fetch one symbol once per UTC day and cache
  24h — negligible load).
- **Determinism**: a weekly row closes **7 days after its date**; rows whose close
  time is still in the future (the in-progress week) are dropped — same
  closed-candles-only rule as the crypto path. Cache keyed `TSLA|<date>` etc.
- **Failure mode (observed 2026-09-30 from the dev sandbox)**: stooq fronts the
  CSV endpoint with a JavaScript proof-of-work anti-bot challenge for some
  datacenter IPs, and **hard-denies others even after the challenge is solved**
  (HTTP 200 body "Access denied" with a solved `auth` cookie). Residential/EU
  consumer egress IPs typically get the CSV directly. Any non-CSV payload,
  challenge page, <40 closed rows, or network error → **synthetic tokenless
  fallback** (unscored, staleness marked by construction). The whitelist still
  accepts the symbol so deep links keep working through a degraded day.
- **Source label**: `stooq` → "live data" (real OHLC).

## 3. vibe/vibe launches — launch-of-the-day (derived secondary source)

- **URL**: `https://testnet.vibevibe.fun/api/v1/chains/46630/v6/launches?limit=5`
  (cursor API, max limit=5 — sufficient for launch-of-the-day). Real payload
  shape captured in `research-cache/launches_ALL.json` (top level
  `apiVersion/requestId/data{items,page}/meta`; items carry `launchId`, `name`,
  `symbol`, `createdAt`, `graduated`, `curve{...}`, `market{holderCount,
  volume24hPairUnits, buyCount24h, sellCount24h, priceChange*Bps, ...}`).
- **Wiring**: `GET /api/candles?source=launch` (the only whitelisted source
  value; the client passes `/?source=launch` through). The launch ticker becomes
  the level symbol — sanitized: uppercase, non-alphanumerics stripped, max 10
  chars, fallback `VIBELAUNCH`.
- **Cost / license**: free, keyless, platform's own public testnet API
  (chain 46630 = Robinhood Chain testnet). One request/hour max thanks to cache.
- **Caching & the day pin**: the raw response is cached **1h keyed by the UTC
  hour bucket**; the launch-of-the-day resolution is then **pinned per UTC date**
  (`sha256(utcDate) mod items.length` over the API's newest-5 list). The pin is
  what keeps "same date → byte-identical response" true even though the newest-5
  membership drifts during a day. Caveat (documented): the pin lives in memory,
  so a server restart mid-day re-resolves from the current top-5 — the terrain
  stays internally consistent (one launch per response + token), but may differ
  from a pre-restart response for the same date. First success of the day wins.
- **Derived-terrain mapping** (`src/lib/vibe-launch.ts` `vibeLaunchCandles` —
  same text in code comments; deterministic in (launch, date) only, never
  `Date.now()`):
  - `count = clamp(60, 60 + floor(ageDays at level date), 219)` — the launch's
    **real age** shapes level length.
  - `vol24 = Number(volume24hPairUnits)/1e18`; `volScore = clamp01(log10(1+vol24)/6)`
    — real 24h pair volume scales volatility.
  - `holdScore = clamp01(log2(1+holderCount)/8)` — real holder count calms the
    path (`noise = 0.06 − 0.03·holdScore`).
  - `dirBias = clamp(-1, (buyCount24h − sellCount24h)/(buys+sells), 1)` — real
    24h buy/sell flow sets drift direction; `baseDrift = dirBias·(0.004 +
    0.02·volScore)·(graduated ? 1.5 : 1)`.
  - Micro-structure (wicks, regime shifts every ~20 candles) from
    `mulberry32(hashString("cc-vibe-v1:" + launchId + ":" + date))`. Prices are
    abstract units anchored at 100 — the real metrics shape character, they are
    not fake OHLC.
  - `priceChange*Bps` fields are ignored: frequently `null` in the captured
    payload; buy/sell counts are always present.
- **Honesty**: `seed.source = "vibe-launch"`, `seed.interval = "derived"`, UI
  label "vibe launch". This is **derived** data — it must never be presented as
  live prices of the token.
- **Failure mode**: fetch error, non-OK status, or no valid items → the daily
  **synthetic tokenless path** (same rule as every feed failure).

## 4. Synthetic fallback (not a feed, but part of every failure path)

- **Source**: `src/game/cc/level-source.ts` `syntheticCandles(date, LIMIT)` —
  `mulberry32(hashString("cc-daily-v1:" + date))` over the daily seed; identical
  client- and server-side, so the game stays playable with the API down.
- **Determinism**: pure function of the UTC date.
- **Cost**: none, no network.
- **Failure-mode role**: tokenless (no `runToken`) → runs on it are **unscored**
  client-side (`GameCanvas` submit gating) and would be rejected server-side
  (403). Staleness/outrage is thus always marked honestly.
