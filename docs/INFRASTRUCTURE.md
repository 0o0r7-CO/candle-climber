# INFRASTRUCTURE — GitHub Student Pack, verified live

> Data source: `education.github.com/pack` scraped server-rendered HTML on **2026-09-28**
> (offers change monthly — re-verify before claiming anything).
> Scope: what is actually useful for **Candle Climber** now/later + a reusable playbook
> for any future project. Companion to CC-PLAN §5.

## 0. TL;DR decisions for Candle Climber

| Phase | Tool | Action | Why |
|---|---|---|---|
| p1 (now) | **MongoDB Atlas** | Claim $50 credits → `DATABASE_URL` | Leaderboard persistence; $50 on M0 free-tier usage lasts years |
| p1 (now) | **Vercel Hobby** | Deploy via browser OAuth | Free (not part of Pack — unchanged plan) |
| p1 (now) | **GitHub Copilot Student** | Enable on owner account | Unlimited completions — free dev velocity for the whole build |
| p2 | **Namecheap** | Claim 1yr `.me` + 1yr SSL | Game domain (e.g. candleclimb.me) |
| p2 | **Sentry** | Activate student Team plan | 50K errors/100K transactions/500 replays — production error tracking |
| p2 | **BrowserStack** | Activate Automate Mobile | Real iOS/Android testing of the canvas game + touch controls |
| p2 | **SimpleAnalytics** | Claim 1yr Starter | Privacy-friendly, 100k views/mo — growth loop measurement |
| p3 | **Heroku** | Claim $13/mo × 24 mo | **Replaces DigitalOcean (removed from Pack)** — hosts the duel/match WebSocket server |
| p3 (opt) | **Blockchair** | 100K free API requests | Multi-chain market data experiments (chain-data side quests) |
| anytime | **1Password / Termius / GitLens** | Claim | Secrets hygiene + SSH + Git QoL for the owner |

**Skip (rationale):** Clerk (wallet auth = Reown, no email auth needed), Datadog + New Relic
(Sentry covers it — avoid observability sprawl), Stripe $25 (payouts are onchain, no card flow),
Camber GPU (no ML workload), Azure $100 (nothing needs it; Vercel+Atlas cover us; revisit if we
ever need containers/VMs for game servers), .TECH/Name.com (Namecheap covers domain), feature
flags (ConfigCat/DevCycle — overkill until live-ops at scale; mutations are seed-driven already).

## 1. Live inventory, categorized (2026-09-28)

Legend: ✅ = use in this project · 🔧 = dev QoL, owner's choice · 🎓 = learning value · ⬜ = skip
Ratings assume a small web3 game / web-app studio of 1–2 people.

### Cloud & hosting
| Offer | Live terms | Verdict |
|---|---|---|
| Heroku | $13/mo credit for 24 months (~$312 total) | ✅ p3 match server; replaces DO |
| Microsoft Azure | 25+ free services + $100 credit, no credit card (18+) | ⬜ (revisit for VM/container needs) |
| Heroku Data / others | — | ⬜ |
| GitHub Pages | free static site per repo | 🔧 (docs/landing mirror) |
| Appwrite | Education plan, 2 projects (BaaS + hosting) | ⬜ (we have Next.js+Atlas; keep as alt-BaaS) |
| GitHub Codespaces | free monthly core-hours | 🔧 (cloud dev box) |

### Databases & backend services
| Offer | Live terms | Verdict |
|---|---|---|
| MongoDB Atlas | $50 credits + Compass + University cert ($150) | ✅ p1 — leaderboard DB |
| Clerk | Pro plan free while student | ⬜ (Reown wallet auth instead) |
| Supabase | **NOT in the Pack today** (free tier exists independently) | ⬜ unchanged |
| Testmail | Essential plan free | 🔧 (API/email testing) |
| Stripe | $25 fee-offset credits | ⬜ |

### Dev tools & AI
| Offer | Live terms | Verdict |
|---|---|---|
| GitHub Copilot Student | free, unlimited completions + AI credits allowance | ✅ enable now |
| JetBrains | all desktop IDEs, annual renewal | ✅ (WebStorm if owner wants; VS Code fine too) |
| GitLens | free Pro while student | 🔧 |
| GitKraken / Tower / WorkingCopy | free Pro while student | 🔧 (pick one; mobile: WorkingCopy) |
| Termius | Pro + Team features free | 🔧 (SSH to p3 server) |
| LocalStack | free license | ⬜ (no AWS usage) |
| Requestly | offer active | 🔧 (API mocking during dev) |
| BrowserStack | Automate Mobile, 1 parallel/1 user, 1yr | ✅ p2 mobile QA |
| Codecov / CodeScene / DeepScan | free/trial while student | ⬜ (CI already has lint+tsc; revisit at 3+ contributors) |

### Observability
| Offer | Live terms | Verdict |
|---|---|---|
| Sentry | 50K errors, 100K transactions, 1GB attachments, 500 replays, Team, 1yr (renewable) | ✅ p2 |
| Datadog | Pro, 10 servers, 2 years | ⬜ (Sentry suffices) |
| New Relic | free while student ($300/mo value) | ⬜ (same) |
| Honeybadger | free Small plan | ⬜ (same) |

### Domains, web & growth
| Offer | Live terms | Verdict |
|---|---|---|
| Namecheap | 1yr `.me` + 1yr SSL | ✅ p2 — game domain |
| Name.com | select free domain (25+ TLDs) | ⬜ (Namecheap covers) |
| .TECH | 1 standard domain, 1yr | ⬜ |
| SimpleAnalytics | Starter 1yr, 100k pageviews/mo | ✅ p2 growth loop |
| Polypane | free while student | 🔧 (responsive/debug browser) |
| Bootstrap Studio / Visme / Octicons | free / 3mo / open | ⬜ (custom design system already) |
| Icons8 | 3mo full subscription | 🔧 (fallback icon source; brand assets are ours) |
| IconScout | 60 premium icons | 🔧 |

### Security & productivity
| Offer | Live terms | Verdict |
|---|---|---|
| 1Password | free while student | ✅ — store rotated GitHub PAT, Reown keys, Atlas creds |
| Dashlane | Premium 6mo | ⬜ (1Password wins) |
| Microsoft 365 | free/discounted incl. Copilot in Office | 🔧 owner's choice |
| Notion | Education plan | 🔧 |
| PomoDone / GitHub Desktop | free | 🔧 |

### Crypto-specific
| Offer | Live terms | Verdict |
|---|---|---|
| Blockchair | 100,000 free API requests (major chains) | ✅ p3 experiments (chain data for Robinhood Chain side quests) |

### Learning (owner development budget — all free via Pack)
FrontendMasters (6mo all-access) ✅ recommended · Scrimba · Boot.dev (backend games/Go/TS) ·
Educative · DataCamp · Codédex · InterviewCake · AlgoExpert (20 free) · Deepnote (data notebooks) ·
Arduino/Adafruit (hardware fun) · GitHub Foundations Certification prep ✅ (resume value).

### Notable REMOVALS / absences (vs common outdated knowledge)
- **DigitalOcean $200 credits — GONE.** Old plans citing DO must switch to Heroku credits.
- **Supabase — not currently in the Pack.**
- SendGrid/Travis CI/Atom-era tools long gone; CI = GitHub Actions (free 2,000 min/mo on Free, more as Pro).

## 2. Reusable playbook (future projects — the real deliverable)

Rule of thumb: **claim in this order, always.**
1. **Identity & safety first:** 1Password → rotate any token ever pasted in chat → enable 2FA everywhere.
2. **Dev velocity:** GitHub Pro + Copilot Student + JetBrains (if IDE person) + Codespaces hours.
3. **Pick ONE deploy host** by workload: static/Next.js → Vercel Hobby (free, not Pack) ·
   long-running server (WebSocket/game/cron) → Heroku credits · need VM/container → Azure $100.
4. **Pick ONE database** by shape: document/leaderboards → MongoDB Atlas $50 · relational+auth
   → Supabase free tier (independent of Pack) · nothing → don't add one.
5. **Observability = Sentry, full stop.** Add Datadog/NR only when a specific need Sentry can't meet appears.
6. **Domain at p2, not p1** (renames are free before you print it anywhere): Namecheap `.me` or Name.com.
7. **Mobile/web QA before launch:** BrowserStack Automate Mobile (canvas games especially).
8. **Growth measurement from day one of beta:** SimpleAnalytics (privacy-friendly = no cookie banner).
9. **Learning budget is a Pack feature:** FrontendMasters/Boot.dev = compounding returns; schedule it.
10. **Skip anything with a monthly-maintenance cost after credits run out** — a student project
    should die of natural causes, not of a credit card charge.

### Project archetypes → stack cheatsheet
| Archetype | Host | DB | Extra |
|---|---|---|---|
| Landing/docs | GitHub Pages / Vercel | — | — |
| Web app (Next.js) | Vercel Hobby | Atlas M0 | Sentry, SimpleAnalytics |
| Game with realtime | Vercel + Heroku (WS server) | Atlas / Redis-on-Heroku | BrowserStack, ConfigCat |
| Data/ML | Deepnote / Camber GPU | Atlas | Azure credit |
| SaaS w/ billing | Vercel | Atlas + Clerk Pro | Stripe credits |

## 3. Credential checklist (owner actions, in order)

- [x] GitHub PAT (already in use — **rotate after build phase**, store in 1Password)
- [ ] Enable **Copilot Student** (education.github.com → Copilot)
- [ ] p1: Vercel deploy via browser login (no token needed)
- [ ] p1: MongoDB Atlas M0 → create cluster → `DATABASE_URL` → paste to Vercel env + `.env.local`
- [ ] p2: Namecheap `.me` claim → DNS → Vercel
- [x] p2: Sentry — DONE 2026-10-01 (org `james-thomas-st`, project `candle-climber`, SDK wired, event verified; see §4 below)
- [ ] p2: BrowserStack + SimpleAnalytics claims
- [ ] p3: Heroku credit claim → duel server app
- [ ] anytime: 1Password student plan

Nothing beyond this list is needed for the current build.

## 4. Sentry production monitoring (wired 2026-10-01)

Owner created the Sentry account + admin token (`sntryu_…`); I did the rest end-to-end.

- **Org** `james-thomas-st` (region us) · **Project** `candle-climber` (`javascript-nextjs`,
  created via API) · DSN public: `https://059663a5fc68fe45cbcf425ebaaea26e@o4512112704028672.ingest.us.sentry.io/4512177773608960`
- **SDK** `@sentry/nextjs@11.1.0` — init split by runtime:
  `src/instrumentation.ts` (node/edge register + `onRequestError`),
  `src/instrumentation-client.ts` (client init + `onRouterTransitionStart`),
  `src/sentry.{server,edge}.config.ts`. `next.config.ts` wrapped with
  `withSentryConfig` from `@sentry/nextjs/config` (v11 moved it out of the root export).
- **Sampling**: traces 10% · Session Replay **on-error 100% / session 0%** (canvas is not
  recorded; DOM UI is) · privacy: `dataCollection: { userInfo: false, cookies: false }`.
- **Boundaries**: `src/app/global-error.tsx` reports render-fatal errors (SUMMIT LOST UI).
- **Probe**: `GET /api/debug-sentry` (hint) / `?go=1` (sends one info event, returns
  `event_id`) — works on every deploy for instant pipeline checks.
- **Build wiring**: `SENTRY_AUTH_TOKEN` in local `.env` → build creates a release pinned
  to the git SHA and uploads source maps (verified: "Successfully uploaded source maps").
  On Vercel the token must be added as env var **O7** or source-map upload is skipped
  (build still passes; error reporting itself does NOT need the token).
- **O7 CLOSED (2026-10-01)**: owner-supplied Vercel API token → added `SENTRY_AUTH_TOKEN`
  (secret) + `NEXT_PUBLIC_SENTRY_DSN` to all targets via API → redeployed.
- **Source-map root-cause chain (commit `c8b8301`)**: (1) `withSentryConfig` had no
  explicit `release` → plugin resolved the release name inconsistently across
  environments; (2) `silent: true` swallowed all plugin diagnostics; (3) **Next 16 /
  Turbopack emits ZERO client `.map` files by default** (verified: 0 maps in
  `.next/static` vs 57 in `.next/server`) so client stack traces stayed minified.
  Fix in `next.config.ts`: `release: { name: SENTRY_RELEASE || VERCEL_GIT_COMMIT_SHA ||
  git rev-parse HEAD }`, `productionBrowserSourceMaps: true`, `silent: false`,
  `debug: SENTRY_DEBUG==='1'`. Note: v11 CLI uploads via **artifact bundles**
  (`artifactbundle/assemble`), so `/releases/{sha}/files/` returning 0 is EXPECTED —
  verify by event symbolication, not the files endpoint.
- **Verified end-to-end (twice)**: probe event `70d24b51…` (local, release `603edca…`)
  and probe event from PROD on release `c8b8301c…` → issue `CANDLE-CLIMBER-1`,
  symbolicated frame `src/app/api/debug-sentry/route.ts`, release attribution exact.
- **Secrets**: auth token lives only in gitignored `.env` (never commit; rotate if leaked).
- **TODO (UI-only, API refused)**: DSN key hardening — allowedDomains + rate limit under
  Project → Settings → Client Keys (2 minutes, non-blocking).
