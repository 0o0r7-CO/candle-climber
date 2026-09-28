// Daily mutations — deterministic per-date game modifiers (roadmap D8-9).
// Same UTC date => same mutation worldwide, derived from the same seed string
// used by the level builder so level + mutation always agree across clients.
import { hashString } from "./rng";

export interface MutationMods {
  gravity: number; // multiplier on GRAVITY
  jump: number; // multiplier on JUMP_V
  camSpeed: number; // multiplier on camera base/max speed
  crumbleTime: number; // absolute seconds before a red candle disappears
}

export interface Mutation {
  id: string;
  name: string; // HUD / death-card label
  tagline: string; // ready-screen flavor line
  mods: MutationMods;
}

export const BASE_MODS: MutationMods = { gravity: 1, jump: 1, camSpeed: 1, crumbleTime: 0.26 };

const POOL: Mutation[] = [
  {
    id: "clean",
    name: "CLEAN CHART",
    tagline: "Textbook price action. Pure skill, no excuses.",
    mods: BASE_MODS,
  },
  {
    id: "lowgrav",
    name: "LOW LIQUIDITY",
    tagline: "Thin market. You float like a meme pump.",
    mods: { gravity: 0.68, jump: 0.92, camSpeed: 1, crumbleTime: 0.26 },
  },
  {
    id: "heavy",
    name: "WHALE HOUR",
    tagline: "Someone is dumping. Gravity is not your friend.",
    mods: { gravity: 1.28, jump: 1.1, camSpeed: 1, crumbleTime: 0.26 },
  },
  {
    id: "rush",
    name: "HIGH VOLUME",
    tagline: "The chart moves fast. Keep up or get liquidated.",
    mods: { gravity: 1, jump: 1, camSpeed: 1.22, crumbleTime: 0.26 },
  },
  {
    id: "fragile",
    name: "PAPER HANDS",
    tagline: "Red candles fold twice as fast today.",
    mods: { gravity: 1, jump: 1, camSpeed: 1, crumbleTime: 0.15 },
  },
];

export function dailyMutation(seedStr: string): Mutation {
  const h = hashString("cc-mutation:" + seedStr);
  return POOL[h % POOL.length];
}

export function mutationById(id: string): Mutation | undefined {
  return POOL.find((m) => m.id === id);
}
