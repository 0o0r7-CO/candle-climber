// P7.1 rival bot — personality mapping (PURE, zero I/O, zero randomness).
// Maps the character registry vibes (characters.ts) to planner parameters.
// Spec anchors: venom => reckless · cop => precise · bull => greedy · frost => patient.
// Every other roster character maps by its declared vibe; unknown vibes fall
// back to a balanced default. Deterministic: same charId ⇒ same personality.
import { getChar } from "../characters";

/** Tunable knobs consumed by the jump planner (all clamped 0..1). */
export interface BotPersonality {
  /** Risk tolerance — high = accepts landings near a platform's edge (small margin). */
  risk: number;
  /** Precision — high = demands a well-centered predicted landing before pressing. */
  precision: number;
  /** Greed — high = holds RUSH (camera ×1.28, +25% gains, less reaction time). */
  greed: number;
  /** Patience — high = deliberately delays the press after landing (seconds). */
  patienceS: number;
  /** Sloppiness — deterministic per-landing execution error (press fires a few
   *  ticks off the ideal moment; committed even if the re-check turns negative). */
  sloppiness: number;
  /** Short label for HUD / ready panel (e.g. "RECKLESS"). */
  label: string;
}

/** Balanced fallback — the CLASSIC vibe and any unknown vibe keyword. */
export const DEFAULT_PERSONALITY: BotPersonality = {
  risk: 0.5, precision: 0.5, greed: 0.35, patienceS: 0.05, sloppiness: 0.5,
  label: "BALANCED",
};

// vibe keyword (characters.ts CharDef.vibe) → personality. The four spec-mandated
// vibes are pinned; the rest are sensible flavor mappings in the same spirit.
const VIBE_TABLE: Record<string, BotPersonality> = {
  // --- spec anchors ---
  menacing: { risk: 0.9, precision: 0.15, greed: 0.6, patienceS: 0, sloppiness: 0.9, label: "RECKLESS" }, // wickvenom
  lawful:   { risk: 0.35, precision: 0.9, greed: 0.3, patienceS: 0.05, sloppiness: 0, label: "PRECISE" }, // wickcop
  heroic:   { risk: 0.7, precision: 0.35, greed: 0.95, patienceS: 0, sloppiness: 0.6, label: "GREEDY" }, // goldenbull
  cold:     { risk: 0.25, precision: 0.6, greed: 0, patienceS: 0.18, sloppiness: 0.3, label: "PATIENT" }, // frostliquidator
  // --- rest of the roster by declared vibe ---
  classic:    DEFAULT_PERSONALITY,
  euphoric:   { risk: 0.8, precision: 0.2, greed: 0.7, patienceS: 0, sloppiness: 0.8, label: "RECKLESS" }, // scarfrunner
  stoic:      { risk: 0.45, precision: 0.75, greed: 0.3, patienceS: 0.05, sloppiness: 0.2, label: "PRECISE" }, // visordroid
  grumpy:     { risk: 0.3, precision: 0.65, greed: 0.15, patienceS: 0.12, sloppiness: 0.4, label: "PATIENT" }, // grump
  sneaky:     { risk: 0.65, precision: 0.4, greed: 0.6, patienceS: 0, sloppiness: 0.7, label: "GREEDY" }, // goblin
  disciplined:{ risk: 0.4, precision: 0.85, greed: 0.25, patienceS: 0.05, sloppiness: 0.1, label: "PRECISE" }, // cadet
  grind:      { risk: 0.35, precision: 0.6, greed: 0.2, patienceS: 0.08, sloppiness: 0.4, label: "PATIENT" }, // trader
  curious:    { risk: 0.55, precision: 0.5, greed: 0.45, patienceS: 0.05, sloppiness: 0.5, label: "BALANCED" }, // bot-sheet
  wild:       { risk: 0.95, precision: 0.1, greed: 0.75, patienceS: 0, sloppiness: 1, label: "RECKLESS" }, // cowboy-sheet
  dandy:      { risk: 0.45, precision: 0.8, greed: 0.4, patienceS: 0.05, sloppiness: 0.3, label: "PRECISE" }, // dapper-sheet
  undead:     { risk: 0.3, precision: 0.5, greed: 0.1, patienceS: 0.2, sloppiness: 0.5, label: "PATIENT" }, // zombie-sheet
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Pure lookup — unknown / classic ids get the balanced default. */
export function personalityForCharId(charId: string): BotPersonality {
  const vibe = getChar(charId).vibe;
  const p = VIBE_TABLE[vibe] ?? DEFAULT_PERSONALITY;
  return {
    risk: clamp01(p.risk),
    precision: clamp01(p.precision),
    greed: clamp01(p.greed),
    patienceS: clamp01(p.patienceS),
    sloppiness: clamp01(p.sloppiness),
    label: p.label,
  };
}
