# INFRASTRUCTURE — zero direct cost, GitHub Student Developer Pack

> Constraint: **no paid tiers, no direct monetary cost.** Primary sources are
> GitHub Student Developer Pack offers and always-free tiers. Every credential
> is stored as a GitHub Actions/Codespaces secret or local `.env.local` (never committed).

## 1. Active today (M1)

| Need | Service | Tier | Student Pack? | Status |
|---|---|---|---|---|
| Source control | GitHub repo (`0o0r7/candle-climber`) | Free | ✅ Pack core | **LIVE** |
| CI (lint + typecheck) | GitHub Actions | Free for public repos | ✅ Pack core | **LIVE** (`.github/workflows/ci.yml`) |
| Cloud IDE | GitHub Codespaces | 120 core-hrs/mo free | ✅ Pack | available |
| AI pair coding | GitHub Copilot Pro | Free for students | ✅ Pack | available |
| Market data | Binance public klines (no key, server-proxied + cached) | Free | — | **LIVE** |
| Local runtime | Bun + Next.js 16 dev server | Free | — | **LIVE** |

## 2. Phase p1 (D4–7) — leaderboard persistence + deployment

| Need | Service | Tier | Student Pack? | Notes |
|---|---|---|---|---|
| Web hosting | **Vercel Hobby** (primary) | Always free, zero-config for Next.js | ❌ (free tier) | Connect repo via GitHub OAuth in browser — no token required |
| Web hosting (backup) | **DigitalOcean App Platform** | $200 / 12 mo credit | ✅ **Pack** | Fallback if Vercel limits are ever hit |
| Leaderboard DB | **MongoDB Atlas M0** (primary) | Free M0 cluster + $50 credit | ✅ **Pack** | M0 never pauses on inactivity — good for a daily game |
| Leaderboard DB (alt) | **Supabase Free** | 500 MB Postgres + realtime | ❌ (free tier) | Pauses after 1 week inactivity; pick if realtime needed later |
| Secrets | GitHub Actions / Codespaces secrets | Free | ✅ Pack core | `DATABASE_URL` etc. |

## 3. Phase p2 (D8–12) — identity, domain, observability

| Need | Service | Tier | Student Pack? |
|---|---|---|---|
| Wallet connect | **Reown (WalletConnect) Cloud** | Free project ID | ❌ (free tier) |
| Domain | **Namecheap** `.me` + SSL | Free 1 year | ✅ **Pack** |
| Error tracking | **Sentry** free tier | 5k errors/mo | ❌ (free tier) |
| Stock data proxy | Yahoo Finance public endpoint | Free, no key | — |

## 4. Phase p3 (D10+) — chain

| Need | Service | Tier | Student Pack? |
|---|---|---|---|
| RPC / faucet | Robinhood Chain testnet public endpoints | Free | — (platform) |
| Contract deploys | Testnet gas from faucet | Free | — (platform) |
| Duel escrow server | DigitalOcean credit (Pack) or Fly.io free allowance | Free | ✅ **Pack** |

## 5. Credential checklist — what the owner sends, and when

| When | Credential | How the owner gets it | Needed by agent? |
|---|---|---|---|
| ✅ Now | **GitHub PAT** (sent) | — | ✅ received, stored locally only |
| p1 deploy | none — owner logs into **vercel.com** with GitHub and imports the repo | browser | ❌ no token needed |
| p1 DB | MongoDB Atlas connection string (M0) | atlas.mongodb.com → sign in with GitHub → M0 cluster → connect | ✅ send `DATABASE_URL` (or set it as a repo secret themselves) |
| p2 wallet | Reown Cloud **project ID** | cloud.reown.com → sign in with GitHub → new project | ✅ send project ID |
| p2 domain | Namecheap .me claim | Pack offer page → redeem | owner-only (registrar UI) |

**Rule of thumb: nothing else is needed now.** At each phase the agent will name
the exact credential and the free tier to create it with.

## 6. Security hygiene

- The GitHub PAT lives only in `.gh_token` (chmod 600, gitignored). **Rotate it
  after the build phase** — it was pasted in plain chat.
- `.gitignore` hardens the public repo: research archives, worklogs, tokens,
  `.env*` and internal tooling are excluded; history was squashed to a single
  clean commit before the first push.
- All runtime secrets go to GitHub repo secrets / Vercel env vars — never in code.
