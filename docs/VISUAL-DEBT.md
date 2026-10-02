# VISUAL DEBT — ledger & sweep log

> Established 2026-10-02 per the architecture decision (owner-approved): ship
> technical/economic layers first, visuals LAST, recording every visual bug in
> this list instead of fixing mid-build. This file is the single ledger.
> Rule: fixes are CSS/layout-only unless explicitly re-scoped; engine, W5
> anti-cheat and gameplay code stay untouched. Every fix lands with a browser
> sweep screenshot under `qa/visual-sweep/`.

## Sweep method

`agent-browser` against PROD, two viewports (412×915 mobile, 1280×800 desktop),
states: boot/ready panel, character select, gameplay (solo + VS BOT), death
panel, archive browser, stock rails view (`?symbol=TSLA`), duel entry.

## Sweep 1 — 2026-10-02 (fixed in the same commit)

| ID | Severity | Found at | Symptom | Root cause | Fix |
|----|----------|----------|---------|-----------|-----|
| VD-1 | MEDIUM | m-05 TSLA mobile | HUD chip row (with weather chip) overlapped the CANDLE CLIMBER title | `.cc-panel` is centered in the full-viewport overlay while the HUD is `position:absolute` z-30 — tall panels slid under the chips | `.cc-overlay` reserves 76px top clearance; panel `max-height: calc(100dvh - 92px)` |
| VD-2 | MEDIUM | m-06 archive mobile | Era blurbs clipped mid-word at the screen edge ("before breakfa…", "went with") with no ellipsis | TWO layers: (a) `width: min(620px, 94vw)` + 32px overlay padding = 419px on a 412px screen → panel overflowed the viewport; (b) nowrap blurbs' min-content width pushed rows past the panel (20px horizontal scroll) | (a) panels sized `min(Npx, calc(100vw - 32px))`; (b) VD-2b below |
| VD-3 | LOW | m-01/m-05 mobile | Seed chip wrapped to 3 lines (SOLUSDT / · / 2026-10-02), tripling HUD height | chip text wrapped freely at 13px in a 412px row | `white-space: nowrap` on the seed chip + compact chip scale ≤480px |
| VD-4 | MEDIUM | d-01/d-02 desktop 800px | Character select + START CLIMB sat below an invisible fold — `.cc-panel` scrolls internally (1074px content in 734px box) but showed no affordance; first-time desktop players see no START button | `overflow-y: auto` with hidden scrollbars + generous paddings | Partial: visible slim scrollbar + compact panel padding ≤840px + sticky ▾ scroll-hint (VD-4b). Full above-fold CTA at 800px deferred — needs content compaction, not CSS (15-char roster is inherently tall) |
| VD-2b | MEDIUM | re-sweep m-08b | Panel width fixed but blurbs' nowrap min-content still pushed rows 20px past the panel box (horizontal scroll; apparent mid-word clip) | flex item automatic min-size from nowrap text despite min-width:0 on `.cc-arch-main` | Blurbs wrap (`white-space: normal; overflow-wrap: anywhere`) — full copy readable, better than ellipsis; `min-width: 0` on rows; footer `z-index: 15` below overlay (tall panels no longer collide with the compliance line) |

Verified-fixed states (re-sweep after deploy): VD-1 m-07, VD-2 m-08, VD-3 m-09,
VD-4 d-05 (see table footer when filled).

## Sweep 2 — 2026-10-02 (V-PHASE, fixed in the same commit `f9502a7`)

Trigger: owner flagged a "stretched" visual + all tech layers done → the planned
visual phase. Root-cause analysis of the canvas fit found the real geometry bug.

| ID | Severity | Found at | Symptom | Root cause | Fix |
|----|----------|----------|---------|-----------|-----|
| V-1 | HIGH | 1920×937 desktop (analysis + sweep) | World scaled width-locked (`rect.width/VIEW_W` uniform) → on wide/short desktops the 800×480 world overflowed viewport height: ground row + start platform rendered BELOW the fold, everything 2.4× giant ("stretched" look the owner flagged); on portrait phones the world was an unframed 247px strip with dead space | Transform scale derived from width only; no letterbox strategy | Contain-fit `s=min(w/800,h/480)`, band centered horizontally, bottom-weighted vertically (62% of leftover above → sky-above climber composition); full-canvas screen-space clear each frame (no letterbox smear) + `.cc-canvas` CSS bg so letterbox areas match the page. Input is coordinate-free (`engine.press()`) → zero gameplay impact; engine/W5 untouched |
| VD-5 | LOW | roster chips | "GOLDEN BUL…", "FROST LIQ…" ellipsis truncation | nowrap + text-overflow on 54px names | 2-line wrap (`-webkit-line-clamp:2`), centered, min-height keeps chips uniform — verified: `overflow:false` on all names |
| VD-6 | LOW | 412px mobile | Footer links crammed bottom-left in 2 lines against right-parked SOUND ON | asymmetric padding-right 104px reservation | Footer lifted `bottom: safe+36px`, centered, wraps cleanly above the sound chip — verified on real device |
| VD-7 | LOW | archive browser | Lazy difficulty tags read as broken "· · ·" | honest placeholder, no affordance | Pulse animation (`cc-tag-pulse` 1.6s) + `title` hint; tags compute as rows scan (verified: LEGENDARY/BRUTAL/ROCKY live) |

### Sweep 2 evidence (`qa/visual-sweep/` + `qa/realdevice/`)

- `v2-fhd-1..4-*.png` 1920×937: ready / running (ground row at 55%, full world framed) / death / archive — fix proven on the problem viewport
- `v2-laptop-*.png` 1280×800: unchanged-good composition (leftover ≈ 0 regression check)
- `v2-mobile-*.png` 412×915: bottom-weighted band, footer lifted, archive tags computed
- `v2-*-geo.json`: viewport + canvas rect + chip-name overflow probes
- REAL DEVICE Pixel 7/Android 13 re-run after deploy: PASS ×5 (session `0a8f64e3-5835-432e-b809-88d4127a9726`, 0 SEVERE console, video on dashboard) — `rd-0*-20261002-183644.png`
- Gates: tsc / lint / 205 tests / build green; CSS + component-decor only, engine/W5 untouched

## Open (none — all recorded debt closed 2026-10-02)

| ID | Severity | Symptom | Why open |
|----|----------|---------|----------|
| — | — | ledger empty | VD-1..7 + V-1 all fixed and re-swept |

## Next sweep

Trigger: launch-prep (pre-announcement final pass) or after any new screen ships
(P4 wallet gate / Balance Gate UI). Re-run the same state matrix + wallet-gate
states + a 2560×1440 ultrawide pass.
