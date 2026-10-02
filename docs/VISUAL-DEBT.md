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
| VD-2 | MEDIUM | m-06 archive mobile | Era blurbs clipped mid-word at the screen edge ("before breakfa…", "went with") with no ellipsis | `width: min(620px, 94vw)` + 32px overlay padding = 419px on a 412px screen → panel overflowed the viewport | Panels sized `min(Npx, calc(100vw - 32px))` (base + archive) |
| VD-3 | LOW | m-01/m-05 mobile | Seed chip wrapped to 3 lines (SOLUSDT / · / 2026-10-02), tripling HUD height | chip text wrapped freely at 13px in a 412px row | `white-space: nowrap` on the seed chip + compact chip scale ≤480px |
| VD-4 | MEDIUM | d-01/d-02 desktop 800px | Character select + START CLIMB sat below an invisible fold — `.cc-panel` scrolls internally (1074px content in 734px box) but showed no affordance; first-time desktop players see no START button | `overflow-y: auto` with hidden scrollbars + generous paddings | Visible slim scrollbar (`scrollbar-*` + webkit) + compact panel padding at `max-height: 840px` |

Verified-fixed states (re-sweep after deploy): VD-1 m-07, VD-2 m-08, VD-3 m-09,
VD-4 d-05 (see table footer when filled).

## Open (accepted / deferred)

| ID | Severity | Symptom | Why open |
|----|----------|---------|----------|
| VD-5 | LOW | Character chip labels truncate with ellipsis ("GOLDEN BUL…", "FROST LIQ…") | Full names live in `title`/aria; chips are identifiable by sprite + portrait; deferring to the next art pass |
| VD-6 | LOW | Mobile footer links wrap to 2 lines bottom-left while SOUND ON sits bottom-right | No overlap (Task 20 fix reserved panel space); cosmetic arrangement acceptable on 412px |
| VD-7 | LOW | Archive lazy difficulty tags render as "· · ·" placeholder chips until computed | Honest lazy placeholder; fills on era play |

## Next sweep

Trigger: after any new screen ships (P4 wallet gate / Balance Gate UI), or at
launch-prep. Re-run the same state matrix + add wallet-gate states.
