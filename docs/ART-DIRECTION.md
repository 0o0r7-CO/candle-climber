# ART DIRECTION — from candlesticks to a world (Canvas 2D visual upgrade plan)

> Written 2026-09-30. Extends — never replaces — the LOCKED design system in CC-PLAN §2
> (palette `#101214`/`#CCFF00`/`#5BD08A`/`#E07856`/`#6A63C8`, Clash Display / JetBrains
> Mono / Instrument Sans, mascot **Wick** the blockbot). Companion docs:
> GROWTH-AND-HOOKS-STRATEGY.md (what the visuals must serve), TOKEN-LAUNCHPAD-RESEARCH.md.
> Chat language FA · Doc language EN.

## 1. The thesis: the risk is grammar, not resolution

Canvas 2D is the RIGHT tool for this genre (Icy Tower / Doodle Jump / Jetpack Joyride are
all 2D). Charts look like trading terminals only when candles are drawn the way a terminal
draws them — flat red/green rectangles. The fix is a fixed **translation grammar** that
turns candle anatomy into environmental architecture. Build it once, and every market
day in history becomes a hand-authored-looking level with zero manual level art. The
data-driven constraint is the advantage: infinite verisimilitude, documentary claim intact.

**Semantic rule (inviolable):** up-green and down-coral always mean up/down. No biome,
era, or weather effect may ever break the market legibility the gameplay depends on
(`#5BD08A` platforms stay trustworthy, `#E07856` platforms stay threatening).

## 2. Candle → world grammar (the core table)

| Candle anatomy | World translation | Material (locked palette) |
|---|---|---|
| Green body | grown slab: mossy living stone / crystal, upward veins | up-green `#5BD08A` on card `#16191C`, lime `#CCFF00` vein glow |
| Red body | cracked charred slab with ember particles | down-coral `#E07856`, ink `#0E1400` cracks |
| Long upper wick | hanging spikes / chains / antenna masts (danger ceiling) | hairline `#24282C` silhouettes + lime tips |
| Long lower wick | roots / underpillars — grip points below the slab | hairline strokes |
| Doji (tiny body) | small floating island — risky, high-reward perch | card tone, lime outline |
| Gap between candles | chasm with depth fog (the real "tapi" of the market) | bg `#101214` gradient |
| High volume | stronger emission + particle density (candles feel ALIVE) | additive glow, pre-rendered |
| Rejected long wick | bent/broken spike — the scar of a rejected price | one-off props |

The mascot ties in by name: **Wick** lives in a world literally built of wicks — spikes,
roots, masts are the recurring silhouette language of both the character and the terrain.

## 3. The 5-layer parallax stack (depth without 3D)

```
L5  foreground   floating tick particles, ticker-tape ribbons, vignette
L4  playfield    candle terrain (Wick lives here) — full detail
L3  midrange     previous daily levels as mountain silhouettes
L2  background   colossal translucent weekly/monthly candles of the SAME symbol
L1  sky          palette from the REAL session clock (pre-market dawn → after-hours night)
```

L2 is the documentary flex: the backdrop behind today's level is the same asset's real
longer history — no other game on the launchpad has a background that is also true.

## 4. Biomes and eras (where hooks become visible)

- **Biome per symbol:** each ticker is a world with its own accent treatment on top of the
  locked palette — e.g. TSLA: electric industrial (coral/lime neon, antenna spires);
  BTC: amber-monolith digital; ETH: violet `#6A63C8` crystal. Green/red semantics NEVER shift.
- **Archive eras (hook H1):** 2020 COVID = cold grey-blue desaturation; 2021 bull = euphoric
  bloom/bloom-haze; 2022 = ash-wash. History gets a color memory — the documentary hook
  becomes visible instead of textual.
- **Weather (hook H2):** ATR → wind (particle streaks, terrain sway), volume → fog density
  (reduced lookahead = mechanical difficulty, honestly data-driven), gaps → tremor shake.

## 5. Character & juice (what "alive" is made of)

- Wick (blockbot) stays the procedural in-game renderer; personality comes from motion:
  squash/stretch on jump/land, run-lean, cape/scarf strip (cheap cloth, big life).
- Death = shatter into candle-colored shards + slow-mo (already shipped) + corpse-sprite
  spawn (feeds H3 Wreckage).
- Camera: smooth follow with vertical lookahead, subtle zoom on near-death, restrained
  shake on impacts. Juice budget: every effect must be ≤ 1 frame of CPU per entity.

## 6. Implementation on the current stack (Canvas 2D, TS, zero frameworks)

1. **Pure translation function** `candles[] → TerrainEntity[]` (slabs, spikes, chasms,
   props, vault spots). Deterministic, unit-testable like `level.ts`/`mutations.ts`
   (W5 suite extended). Rendering never invents geometry.
2. **Segment pre-render:** each screen-height slice of terrain rendered once to an
   offscreen canvas and cached; per-frame work = blits + dynamic entities (Wick, particles,
   float texts). This is the single biggest perf win.
3. **Performance red lines:** no per-frame `shadowBlur` (pre-render all glows);
   pooled particles with hard caps; culling outside camera; DPR-aware canvas sizing;
   `globalCompositeOperation` ('lighter' for glow, 'multiply' for shade) instead of filters.
4. **Assets:** terrain edges via `Path2D` (crisp at any DPR); sprites/textures as WebP
   atlases; palette LUTs per biome/era so recoloring is data, not new art.
5. **Determinism guard:** all visual variation (biome, weather, era) derives from the same
   daily (symbol, date) inputs — a replay must render identically (W5 invariant).

## 7. Visual roadmap

| Ver | Contents | Gate |
|---|---|---|
| **V1 — grammar foundation** | translation layer + palette-mapped materials + 5-layer parallax + juice pass (squash/stretch, trails, landing dust, camera) | feature-flagged side-by-side with current renderer for owner A/B |
| **V2 — mood systems** | Weather (wind/fog/tremor) + session-time sky | after V1 acceptance |
| **V3 — hook visuals** | Wreckage ghosts, Daily Report card art, Archive era palettes, biome accents | with P0 hook rollout |
| **V4 — token era** | Mirror levels ($WICK's own chart), Wick Vault visuals, burn-counter HUD, graduation celebration scene | with P1/P2 rollout |

Untouched by all of the above: physics, determinism, scoring, anti-cheat. V1 is render-only
by construction — the engine consumes `TerrainEntity[]` exactly as it consumes platforms today.
