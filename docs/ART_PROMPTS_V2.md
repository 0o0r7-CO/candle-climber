# ART PROMPTS V2 — Wick Identity Lock

> Owner directive (2026-09-28): the mascot must be **unreachable by ordinary AI prompts**.
> The V1 "chunky blockbot + lime square glasses" formula became a cliché — any AI asked for
> "a cute robot mascot" reproduces it. V2 locks an identity built from **domain-bound traits**
> (wax, wick, charring) that generic prompts never produce.
>
> Seeds (owner's Reve concepts): **Voxel Wick — Candle-Stack** (leaping wax creature over
> candlestick chart, incl. charred "liquidated" state) and **Voxel Wick — Elevated Toy**
> (designer-toy figures on spring pedestals: victorious vs melted/sad states).
> V1 blockbot line is RETIRED. This document is the single source of truth for Wick.

---

## 1. Why V1 failed (lesson learned)

V1 described the character by **role and accessories** ("chunky blockbot, lime body, square
glasses, flame on head"). Role-plus-accessories is exactly how generic prompts are written, so
every model's prior collapses to the same output. V2 describes the character by **material and
physics**: it is not a robot that looks like a candle — it IS a candle creature that lives,
burns, melts, and gets charred. Material-based identity cannot be reached by "cute robot" prompts,
because those prompts contain no wax, no wick, no melting, and no charring.

## 2. Wick v2 — Identity Constitution (LOCKED)

| # | Rule | Detail |
|---|------|--------|
| C1 | One-piece wax body | Head and body are a single rounded-rect block of deep forest-green wax; slightly melted, uneven top edge. No neck, no seams, no mech panels. |
| C2 | Bent wick + flame | One bent black wick thread rises from top center (the kink angle is a signature). Teardrop flame in lime `#CCFF00`. |
| C3 | Burned-in eyes | Two expressive slanted LIME eyes burned into the wax. No screen-face, no glasses, no pupils, no mouth (or at most a tiny char mark). |
| C4 | Stubby limbs | Simple dark stubby arms/legs; may leave small wax puddles under the feet. |
| C5 | State duality (signature trait) | ALIVE = green wax + lime flame + lime eyes. LIQUIDATED = charred black wax texture, coral `#E07856` ember eyes, flame snuffed with a thin smoke trail, small cracks and crumbling wax bits. This duality is the anti-generic core. |
| C6 | Flame = telemetry | Flame size/color tracks game state: bigger on combo streaks, coral tint on red-candle days, white-blue under high volatility, snuffed on death. |
| C7 | Palette lock | bg `#101214` · lime `#CCFF00` · green `#5BD08A` · coral `#E07856` · purple `#6A63C8`. Wax greens stay deep/dark so lime reads hot. |
| C8 | World anchor | Lives on real candlestick charts (green/red bars with thin wicks) or on designer-toy pedestals/springs. Nothing sci-fi. |
| C9 | Proportions | Body ≈ 1 : 1.6 (width : height) single block; total height ≈ 2.5 head-widths; default 3/4 view. |
| C10 | Silhouette test | In solid black, the profile must read as: waxy block + bent-wick flame + stubby limbs. If it reads as "generic robot", the design has failed. |

## 3. Prompt hardening rules (apply to every prompt below)

1. **Lead with material, not role.** Open with "wax candle creature / candle golem", never
   "robot, mascot, agent, android, bot, AI character". Banned words: robot, mascot, agent,
   android, bot, cute AI assistant, cyber.
2. **Always embed the negative tail** (see prompts): no metal, no panels, no screens, no glasses,
   no antenna, no jetpack, not a robot, not humanoid.
3. **Anchor the style** to "designer vinyl toy / voxel collectible figure / matte wax texture" —
   not "3D render of a character".
4. **Name the palette hexes** so color drift cannot reintroduce the V1 lime-body cliché.
5. **Keep traits physically motivated** (wax melts, wicks burn, char remains) — physics is what
   generic prompts lack.

## 4. Paste-ready prompts

### P1 — Identity Anchor (render this one FIRST)
```
A small wax candle creature, designer vinyl collectible toy style, 3/4 studio view, near-black
charcoal background. The body is one rounded rectangular block of deep forest-green matte wax
(#1E4D33) with a slightly melted, uneven top edge. A single bent black candle wick rises from
the top center, tipped with a small teardrop flame in vivid lime (#CCFF00) that casts lime
rim-light across the wax. Face: two expressive slanted lime-green eyes burned into the wax,
no mouth. Two stubby dark arms, short legs, one foot resting in a tiny wax puddle. The creature
leaps energetically above a field of glowing candlestick-chart towers (mint green #5BD08A and
coral red #E07856, each bar with a thin wick) like a tiny skyline. Soft volumetric lime glow,
subtle purple (#6A63C8) accent lights deep in the dark background, chunky toy proportions,
matte wax texture with tiny frozen drips. No metal, no panels, no screens, no glasses, no
antenna, no jetpack, not a robot, not humanoid.
```

### P2 — Turnaround + Liquidated state (model sheet)
```
Character model sheet of the same wax candle creature: designer vinyl collectible toy, three
large views (front, side, back) on a flat near-black background — one rounded block of deep
forest-green matte wax (#1E4D33) with melted uneven top edge, bent black wick with small lime
(#CCFF00) teardrop flame, two slanted lime eyes burned into the wax, stubby dark limbs. Fourth
smaller figure in the corner: the LIQUIDATED state — same silhouette but charred black wax with
cracks, coral (#E07856) ember eyes, the flame snuffed leaving a thin curling smoke trail, small
crumbs of wax falling. Consistent proportions across all views, matte texture, tiny wax drips,
studio lighting, no metal, no panels, no screens, no glasses, no antenna, not a robot, not humanoid.
```

### P3 — Emotion & flame-state sheet
```
Emotion sheet of a wax candle creature, designer vinyl toy style, six poses in a 3x2 grid on a
near-black background, same character each time: one rounded deep forest-green wax block body
(#1E4D33), bent black wick on top, slanted lime (#CCFF00) burned-in eyes, stubby limbs.
1) focused — small steady lime flame; 2) winning — huge lime flame with sparks, arms raised;
3) worried — tiny guttering flame, wax dripping; 4) greedy — oversized flame leaning forward;
5) liquidated — charred black wax, coral (#E07856) ember eyes, smoke trail, snuffed wick;
6) relieved — medium flame, relaxed pose sitting in a wax puddle. Consistent proportions,
matte wax texture, no metal, no screens, no glasses, not a robot, not humanoid.
```

### P4 — In-game readability test (small scale)
```
Minimal game-art test: a very small wax candle creature — rounded deep forest-green wax block
(#1E4D33), bent black wick with lime (#CCFF00) teardrop flame, slanted lime eyes — mid-jump
between tall candlestick platforms of mint green (#5BD08A) and coral red (#E07856) with thin
wicks, on a near-black background (#101214). The creature occupies less than one eighth of the
frame height yet stays instantly readable: strong lime rim-light, chunky silhouette, no
fine detail. Flat dark backdrop, faint purple (#6A63C8) grid glow. No metal, no screens, no
glasses, not a robot, not humanoid.
```

### P5 — PFP avatar (identity for profiles / future Web3)
```
Square PFP avatar: bust crop of a wax candle creature, designer vinyl collectible style —
rounded deep forest-green wax block (#1E4D33) filling the lower frame, melted uneven top edge,
bent black wick with bold lime (#CCFF00) teardrop flame, two slanted lime eyes burned into the
wax, flat near-black background with a faint lime glow behind the flame. Bold simple silhouette,
high contrast, centered, no text. No metal, no panels, no glasses, no antenna, not a robot,
not humanoid.
```

### P6 — Death-card moment art
```
Tragic but cute designer-toy diorama: a wax candle creature, fully liquidated — charred black
cracked wax body slumped and melting into a puddle, bent wick with only a thin curling coral
(#E07856) smoke trail, dim ember eyes, one stubby arm reaching toward a distant glowing lime
flame across a dark candlestick chart floor. Near-black background (#101214), single coral rim
light, matte wax texture, cinematic but minimal. No metal, no screens, no glasses, not a robot,
not humanoid.
```

### P7 (OPTIONAL, later) — Sprite sheet for actual in-game use
Only if we decide to move from procedural canvas rendering to bitmap sprites. Flat colors,
solid magenta background for chroma-keying:
```
4-frame sprite sheet, side view, of a wax candle creature (deep forest-green wax block, bent
black wick, lime teardrop flame, slanted lime eyes, stubby limbs): idle bounce, jump rise,
fall, land squash. Flat colors, thick clean edges, solid pure magenta background for keying,
no anti-aliasing halos, no text, consistent size and alignment across frames. Not a robot.
```

## 5. Reachability Test Protocol (run after P1 renders)

1. **Negative test.** On two *different* AI image tools, run ONLY: "a cute robot mascot
   character, 3D render". Compare outputs against P1. PASS = they produce the generic blockbot
   and none of them accidentally resembles Wick (bent wick + wax block + burned lime eyes combo).
2. **Positive test.** Give a third AI the full P1 prompt. PASS = it converges toward the same
   creature (spec-following is fine — that is controlled reproduction, not genericness).
3. **Silhouette test.** Convert P1 to solid black. PASS = reads as wax-block-with-wick, not robot.
4. If step 1 fails (generic prompts land near Wick), strengthen the unusual traits (kink the wick
   more, char asymmetry, wax puddles) and re-run.

## 6. Review loop & lock checklist

Owner renders prompts on Reve and sends share links (fetch pipeline already built — bare links
are enough). Each render is graded on: **identity fit** (C1–C10) / **gameplay readability** /
**canvas & CSS feasibility**. Design is LOCKED when:

- [ ] P1 anchor approved by owner (silhouette + state duality)
- [ ] Reachability test passes (section 5)
- [ ] Turnaround (P2) consistent enough to drive all later assets
- [ ] Usage split confirmed: procedural canvas stays for gameplay; P1–P6 feed site, cards,
      social, and (later) PFP identities
