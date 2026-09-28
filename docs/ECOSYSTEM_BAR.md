# THE ECOSYSTEM BAR — what vibe/vibe actually expects from this product

> Written 2026-09-29, after owner challenge: "the audit measured us against our own plan —
> measure us against the ecosystem." This doc reconstructs the expectation factors from the
> original deep research (Robinhood Chain builders program, vibe/vibe Discord + ecosystem
> X accounts), as distilled into CC-PLAN §1–2, GAME_DESIGN §8–9, README "Why it fits", and
> the worklog. Sources are marked per factor. This doc supersedes AUDIT.md §1 as the yardstick;
> AUDIT.md remains the code-level evidence base.

## 0. The uncomfortable re-verdict first

Against our internal plan docs the project scores well (see AUDIT.md). **Against the ecosystem
bar it does not — yet.** The parts that are finished and green are the parts ANY competent
developer would build (engine, physics, data pipeline, leaderboard). The parts that make
vibe/vibe specifically care are the parts still missing or parked. Owner's instinct is correct.

| # | Factor | Verdict |
|---|---|---|
| E1 | Working MVP, instantly playable in browser | 🟢 DONE — live at https://candle-climber.vercel.app (real Binance candles) |
| E2 | Ecosystem content flywheel — "every launch becomes a level" | 🟡 PARTIAL — level-source abstraction shipped & wired; real launch-feed pending D10 |
| E3 | Token layer on platform rails (bonding curve, prizes) | 🔴 MISSING (scheduled D10+, correctly sequenced) |
| E4 | On-chain credibility (Robinhood Chain scores, wallet identity) | 🔴 MISSING (scheduled) |
| E5 | X/Twitter viral loop | 🟡 PARTIAL — loop complete (OG cards + live URL + death card); rivalry-tag input unshipped |
| E6 | Platform-native identity (look, tone, mascot) | 🟡 PARTIAL (palette ✓, mascot parked awaiting owner re-brief) |
| E7 | Fair-play / anti-sybil | 🟢 MEETS (MVP level) |
| E8 | Zero-friction onboarding | 🟢 MEETS |
| E9 | Always-on daily service | 🟡 HALF — live daily service up; board on memory fallback until Atlas `DATABASE_URL` |
| E10 | Mobile-first quality | 🟡 PARTIAL — headless QA passed (desktop + iPhone-14 emulation); real-device pass pending |

Scoreboard v2 (2026-09-29, post-deploy): 4 green · 5 yellow · 2 red — up from
3 green · 4 yellow · 3-4 red at first audit. Deploy (E1) converted the biggest
blocker; E9 persistence is one owner-supplied `DATABASE_URL` away; E3/E4 remain
deliberately sequenced behind product reality.

<details><summary>Scoreboard v1 (pre-deploy, kept for the record)</summary>

3 green · 4 yellow · 3-4 red. That is the honest scoreboard.

</details>

## 1. The factors, reconstructed

### E1 · Working MVP — the hard gate of the utility/vibecoded track
The track's stated requirement is a **real, working, browser-playable MVP** — not a concept, not
a deck. Judges and community members click a link and must be playing within seconds. This was
the founding constraint of the whole plan (CC-PLAN header; GAME_DESIGN §1).
**Today:** fully playable locally; zero public URL. Everything below compounds on this one gate.
**Close:** Vercel deploy (owner OAuth) + Atlas `DATABASE_URL`. Nothing else in the backlog
matters until this exists.

### E2 · The content flywheel — "every vibe/vibe launch becomes a future level"
This is the sentence that makes the game ecosystem-native rather than "a crypto game that
happens to be here" (README; CC-PLAN §1 pitch). The platform's core activity is token launches
on the bonding curve; the pitch promises that activity becomes game content automatically.
**Today:** the watchlist is 6 hardcoded CEX symbols (BTC/ETH/SOL/DOGE/XRP/BNB) via Binance
(`api/candles/route.ts`). Real charts, yes — but of coins the platform did not launch. The
ecosystem-specific promise is **0% wired**. This is the owner's core dissatisfaction, correctly felt.
**Close (realistic path):** (a) abstract "level source" behind the existing `/api/candles`
contract so any feed plugs in; (b) when the platform's launch feed / token list is accessible
(D10+ work anyway), map launched tokens → level inputs (their launch chart IS the level);
(c) until then, surface the intent in-UI ("today's chart · next: platform launches") so judges
see the mechanism, not just the claim.

### E3 · Token layer on platform rails
Per the tokenomics strategy captured in GAME_DESIGN §8: **one** game token via the vibe/vibe
bonding curve, in-game currency + daily prizes, feeding both the utility track (1.5%) and the
trader track (1.75%) of the builder task. No multi-launches. This is the reward engine that
makes the builder task pay us.
**Today:** 0%. Scheduled D10+ — correctly sequenced AFTER a deployed product (you cannot bond
a curve to a localhost). But it must not quietly become "never": the leaderboard/duel/prize
economics assume it.
**Close:** keep D10 sequencing; prerequisite = E1 + E2 wiring.

### E4 · On-chain credibility — Robinhood Chain scores + wallet identity
Ecosystem-native products carry their state on the chain when it ships (GAME_DESIGN §7 D14,
§8: scores on-chain at mainnet; wallet auth via Reown instead of email auth — INFRASTRUCTURE
"skip Clerk" decision). Judges read this as "built FOR this chain" vs "ported to it".
**Today:** localStorage + server board; no wallet connect; no chain touch. Scheduled p2/p3.
**Close:** Reown projectId (p2), testnet score checkpoints (p3), mainnet sync (D14).

### E5 · The X/Twitter viral loop
The platform's growth engine is X; the pitch's pillar #3 is "death is the content" (GAME_DESIGN
§1, §6): every liquidation mints a share card with a "BEAT MY RUN →" CTA.
**Today:** the generator is genuinely good (1080×1350, mutation stamp, rival gap, #1 flex,
WebShare). But the loop terminates at a bare link: no `openGraph`/`twitter` meta, no
`metadataBase`, no PWA manifest (AUDIT F4), no deploy URL, rivalry-tag input unshipped.
**Close:** deploy → OG/manifest polish → rivalry tag → showcase GIF.

### E6 · Platform-native identity
The research reverse-engineered the platform's design language so the game reads as born there:
palette lock (#101214/#CCFF00/#5BD08A/#E07856/#6A63C8), Clash Display/Instrument Sans/JetBrains
Mono, blockbot character language, liquidation-humor tone — zero IP copying (CC-PLAN §2,
GAME_DESIGN §9).
**Today:** palette + type are locked in code (verified in `render.ts`/`layout.tsx`). Tone is
present (LIQUIDATED, PAPERHANDS, cause lines). The mascot — the single most identity-carrying
asset — is the generic V1 blockbot, and the V2 identity work is **parked** after the owner's
character-brief correction. For a PFP-native ecosystem, the character IS the brand.
**Close:** owner re-briefs character intent → identity doc rewritten → reachability protocol
→ then site/cards/social all upgrade at once (procedural renderer stays for gameplay).

### E7 · Fair-play / anti-sybil
A stated ecosystem concern (sybil farms plaguing reward programs). Our pitch answers it by
design: skill-only boards, no self-play reward loops, escrow duels with unique match IDs at p3
(GAME_DESIGN §8; README).
**Today:** MEETS at MVP level — server-side plausibility cap (score ≤ candles×70+20), name
sanitizing, 20/min/IP rate limit. Not cryptographic; acceptable until token rewards exist.
**Close:** raise the bar exactly when E3 ships (server-signed run receipts or on-chain scores).

### E8 · Zero-friction onboarding
X-traffic conversion dies on login walls. The plan said it from day one: no wallet, no account
to play (GAME_DESIGN §6 "no login, no friction").
**Today:** MEETS — tap to play, name-only submission, prefs in localStorage.

### E9 · Always-on daily service
A "one daily chart, every player worldwide" product is a commitment device: the server must be
up every day, the board must persist, or the core promise collapses. This is what separates
"a demo" from "a product the ecosystem can adopt".
**Today:** MISSING — localhost, memory leaderboard (resets on restart). Same unlock as E1
(Vercel + Atlas), then it stays solved.

### E10 · Mobile-first quality
The X/Discord audience is overwhelmingly phone-first; a canvas game that janks on Safari iOS
fails E5 retroactively (shares are opened on phones).
**Today:** touch controls, WebShare, viewport handling all implemented but **never tested on
real devices**. BrowserStack Automate Mobile is already mapped in INFRASTRUCTURE (p2).
**Close:** one real-device QA pass (portrait viewport, audio unlock, share sheet) before launch
announcement.

## 2. What this changes in the plan (re-prioritized)

1. **Deploy is the product.** E1+E9 = Vercel + Atlas. Converts 100% of existing work from
   invisible to real. (was already #1 in AUDIT remediation — confirmed as THE gate)
2. **Share-loop day-one readiness** — OG/twitter meta, metadataBase, manifest ship WITH the
   deploy, not after (E5).
3. **E2 becomes a first-class workstream, not a footnote.** Level-source abstraction in the
   data layer now (small), platform-launch feed when accessible (D10 window), in-UI signal
   immediately (one line on the ready screen).
4. **Mascot re-brief is a product task, not an art errand** — it unblocks E6 and every future
   share visual. Owner-driven, parked until the brief is ready.
5. **Mobile QA pass before any announcement** (E10) — one session, BrowserStack or 2 real phones.
6. **Token/onchain phases stay sequenced behind 1–3** (E3/E4) — unchanged, now with explicit
   rationale: bonding a curve to an undeployed game helps nobody.

## 3. One-paragraph answer to "are we there yet?"

The craft core (engine, determinism, fairness, data) is built and verified — that was never
the risk. The ecosystem promise — a deployed daily game whose content is the platform's own
launch activity, wearing the platform's identity, minting X-ready artifacts from every death —
is roughly half-built: the artifact minting exists, the identity is parked, the launch-content
mechanism is 0%, and the whole thing is invisible to the ecosystem until someone other than us
can open a URL. The fastest path to "the ecosystem's expected product" is: deploy → share-loop
polish → launch-as-level wiring → mascot re-brief → mobile pass → token phase.
