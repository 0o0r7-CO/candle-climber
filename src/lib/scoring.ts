// Shared scoring constants — single source of truth coupling the client
// engine's gain math to the server's anti-cheat caps.
// Coupled by test/summit.test.ts (W4): if the engine's gain math changes,
// this file changes with it or the leaderboard starts rejecting legit runs.
export const BASE_GAIN = 10; // per-candle base gain
export const WORLD2_GAIN = 20; // per-candle base gain after graduation (world 2)
export const COMBO_CAP = 12; // streak cap feeding the multiplier
export const COMBO_STEP = 0.5; // multiplier step per streak
// P3.6 RUSH risk premium (PLATFORMER-UX-RESEARCH §5): candle gains ×1.25 while
// SHIFT is held — the price the run earns for the extra speed. Composed AFTER
// the mode/combo multipliers, rounded last (floor at death, engine-side).
export const RUSH_GAIN = 1.25;

// engine max gain: 10 base (20 post-grad world 2) × combo cap (1 + 12*0.5) = 7 → 70 / 140
export const MAX_GAIN_NORMAL = BASE_GAIN * (1 + COMBO_CAP * COMBO_STEP); // 70
export const MAX_GAIN_WORLD2 = WORLD2_GAIN * (1 + COMBO_CAP * COMBO_STEP); // 140
export const MAX_GAIN_WORLD2_RUSH = MAX_GAIN_WORLD2 * RUSH_GAIN; // 175

// Leaderboard anti-cheat cap: must cover BOTH modes (normal + world 2) AND the
// rush premium (P3.6) — otherwise legit full-combo rush runs get rejected.
export const MAX_SCORE_PER_CANDLE = 175;
