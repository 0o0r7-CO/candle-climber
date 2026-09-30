# PLATFORMER UX RESEARCH — control grammar for a candle auto-runner

> Written 2026-10-01 (owner request at Gate G2: "ریسرچ عمیق درباره تجربه گیم‌پلی این سبک
> بازی‌ها و نحوه مدیریت کاربر با کاراکتر"). Doc language EN per checklist convention.
> Purpose: give P2.7 (already shipped) a principled backbone and define exactly what
> P3.6 will implement — and what it will REJECT, with reasons.

## 1. Method (honest scope)

- **Live-fetched primary source**: Maddy Thorson's *"Celeste & Forgiveness"*
  (mattmakesgames.com → `/articles/celeste_and_forgiveness/index.html`), retrieved
  in full on 2026-10-01. Quotes below are verbatim from that page.
- **Search-engine round** (z-ai web_search): returned one relevant hit
  (the Thorson essay) plus the canonical input-buffering essays
  (pancelor.bearblog.dev, wayline.io). Most other queries returned noise;
  no further live quotes are claimed beyond what is listed here.
- **Established industry references** (names/works, not fetched quotes):
  Super Mario Bros. (1985) run-button/momentum grammar; Masahiro Sakurai's
  *"Masahiro Sakurai on Creating Games"* episodes on coyote time and on
  time-loss/risk-reward; Steve Swink, *Game Feel* (2008).

## 2. The forgiveness toolkit (what great platformers actually do)

Verbatim inventory from Thorson's essay — Celeste's ten "game-feel tricks", all
"centered around widening timing or positioning windows, so that everything is
fudged a tiny bit in the player's favor":

1. **Coyote Time** — "You can still jump for a short time after leaving a ledge."
2. **Jump Buffering** — "If you press and hold the jump button a short time before
   landing, you will jump on the exact frame that you land."
3. **Halved-Gravity Jump Peak** — "If you hold the jump button, the top of your
   jump has half gravity applied… gives you more time to adjust for landing."
4. **Jump Corner Correction** — head-bonk on a corner wiggles you around it.
5. **Dash Corner Correction** — clipping a corner pops you onto the ledge.
6. **Semi-Solid Popping** — dashing sideways through a semi-solid pops you up.
7. **Lift Momentum Storage** — jumping off a moving platform banks its momentum.
8. **Wide Wall-Jump Window** — wall-jump from 2px off the wall (¼ tile).
9. **Even Wider Super Wall-Jump Window** — harder maneuvers get *more* tolerance.
10. **Stamina Refunds** — a grace window converts one jump type into another.

The design principle (verbatim): *"this is a big reason why Celeste can feel kind
even though it's very difficult — **it wants you to succeed**."*

**Key reading for us:** difficulty lives in the LEVEL, forgiveness lives in the
INPUT WINDOW. None of the ten tricks make the game easier to beat on paper — they
remove unfair-feeling losses. Our owner's complaint ("dies in the first 1–2
candles") is precisely an unfair-feeling-loss problem, not a difficulty problem.

## 3. Mario's control grammar (the owner's reference point)

Super Mario Bros. established the grammar the owner is asking for:

- **Walk/run as a spectrum** — holding B (run) raises top speed; acceleration is
  gradual (momentum), so speed is *shaped*, not toggled.
- **Variable jump height** — jump velocity is set at takeoff; releasing the button
  early cuts the rise short. Short taps = hops, full holds = max jumps. This is
  the single most important "I control my jump" feature and it is invisible
  unless the game TEACHES it.
- **Momentum before the jump** — running first = longer jump. In Mario this is
  horizontal speed the player controls; in our auto-runner the camera controls it.

## 4. What Candle Climber already had vs. has now

| Technique | Before P2.7 | After P2.7 (`31f19fd`) |
|---|---|---|
| Variable jump height (release-cut) | ✅ `JUMP_CUT 0.72` | ✅ unchanged, but **now taught** in the howto line |
| Coyote time | ✅ `0.09s` | ✅ widened to `0.12s` |
| Jump buffering | ✅ `0.12s` | ✅ widened to `0.16s` |
| Safe runway | ✅ 4-candle launch pad | ✅ unchanged |
| Speed curve | ❌ 175→470 @ +5.5/s (frantic ramp) | ✅ 148→400 @ +3.2/s (readable ramp) |
| Jump reach margin | 137px vs MAX_UP 112 (22%) | ✅ 158px vs 112 (41%) |
| Landing room | 62px caps / 18% full gaps | ✅ 72px caps / 13% full gaps |
| Onboarding bubbles | ✅ first 2 runs | ✅ unchanged |

Celeste's #4–#9 (corner correction, wall windows, momentum storage) map to
mechanics we do not have (no head-bonks, no walls, no moving platforms) — **N/A
by design**, our danger surfaces are wick-spikes and crumble timers, not corners.

## 5. The auto-runner twist — why "free brake" is REJECTED, "RUSH" is accepted

The owner asks: "با یه کلید سرعت رو real-time کم و زیاد کنم، قبل پریدن شتاب بگیرم."
In Mario, horizontal speed is the player's. In Candle Climber the **camera is the
speed** — the player anchor is fixed at 30% of the view. Any speed-mod is therefore
a mod of the whole run's pacing, and scoring is **score = candles passed**
(height), NOT points-per-second. That asymmetry decides everything:

- **Free BRAKE (hold to slow) — REJECTED.** Slowing is pure upside with zero
  trade-off: every hard gap becomes trivial if you may crawl forever. Optimal
  play degenerates into "never move fast", which kills the runner tension and
  the daily-competition economy (§8 honesty: leaderboards must measure nerve,
  not patience).
- **RUSH (hold to accelerate + score premium) — ACCEPTED for P3.6.** The Mario
  run button is asymmetric on purpose: it is an *opt-in risk*. Mirror it:
  HOLD SHIFT ⇒ camera ×~1.28 while held **and** candle gains ×1.25 while held.
  Skilled players trade safety for height-speed; casual players ignore the key
  entirely. Deterministic (input-state, fixed-timestep), W5-testable, and it
  adds a genuine skill ceiling without touching the floor (the P2.7 tuning
  already fixed the floor).
- **Halved-gravity jump peak (Celeste #3) — ACCEPTED for P3.6.** Cheap, pure,
  deterministic: while `vy < 0 && jumpHeld`, apply `GRAVITY × 0.5`. Gives the
  "hang" that makes variable-height jumps landable. Invisible in tests' math
  only where it matters — add a W5 pin.
- **Speed shaping at takeoff ("accelerate before jumping")** — already exists in
  the only form an auto-runner allows: the RUSH multiplier applies to airborne
  horizontal travel too, so rushing into a jump = longer jump. Documented, not
  engineered.

## 6. P3.6 implementation contract (for the checklist item)

1. `Engine.rush` boolean input (`pressRush()/releaseRush()`); speed + gain
   multipliers composed with mutation mods in fixed order (multiplier AFTER mods,
   rounded last — W5 byte-determinism pins).
2. Gravity-hang: `GRAVITY × 0.5` while rising with jump held (pin in tests).
3. Howto line + first-run hints updated ("HOLD SHIFT = RUSH — faster + 25% gains").
4. W5: rush composition, gravity-hang state transitions, determinism under
   rush on/off, world2 parity.
5. Out of scope: free brake, air-direction changes, wall interactions — rejected
   above; revisit only with owner after live playtest of RUSH.

## 7. Answers to the owner's specific asks (mapped)

| Owner ask | Verdict | Where |
|---|---|---|
| سرعت خیلی زیاده / می‌میرم در ۱–۲ کندل اول | FIXED | P2.7 speed curve + forgiveness windows |
| فاصله بین کندل‌ها زیاد است | FIXED | P2.7 caps 62→72, gaps 18%→13% |
| پرش بلند/کوتاه real-time | ALREADY EXISTED — was invisible; now taught; hang improved in P3.6 | howto + P3.6 |
| شتاب قبل از پرش | P3.6 RUSH (risk-priced) | this doc §5 |
| کند کردن سرعت real-time | REJECTED (breaks scoring economy) — revisit only after RUSH playtest | §5 |
| انتخاب تایم‌فریم 1h/4h/1d | ACCEPTED as P3.5 (fits chart-is-the-level; per-tf boards; honest fallbacks) | checklist |
| ریسرچ سبک ماریو | THIS DOC | — |

## 8. Sources

- Maddy Thorson, *"Celeste & Forgiveness"* — fetched in full 2026-10-01
  (mattmakesgames.com, `/articles/celeste_and_forgiveness/index.html`). All §2
  quotes verbatim.
- pancelor, *"input buffering for grid games"* (pancelor.bearblog.dev, 2022) —
  search hit, not fetched.
- *"The Art of Input Buffering"* (wayline.io, 2025) — search hit, not fetched.
- Cyber Shadow Steam community thread — negative example (players criticize the
  *absence* of coyote time), search hit.
- Super Mario Bros. (Nintendo, 1985) run/momentum/variable-jump grammar;
  Masahiro Sakurai on Creating Games (coyote time; time-loss risk/reward);
  Steve Swink, *Game Feel*, Morgan Kaufmann 2008 — established references.
- Note: several supplementary web searches on 2026-10-01 returned unrelated
  results; nothing in this document depends on them.
