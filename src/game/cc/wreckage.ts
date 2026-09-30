// H3 WRECKAGE — "the mountain is carpeted with yesterday's dead" (P2.5).
// Minimal per-device version: every death freezes a translucent ghost at its
// exact fall point, visible to FUTURE climbers of that level on THIS device.
// Full cross-user wreckage lands with O1 (DATABASE_URL, per (symbol,date)
// storage) — the pure core below is storage-agnostic and survives the move.
//
// PURE core: recordWreck takes a db object and returns a NEW db (immutable,
// W5-testable); localStorage load/save are thin client wrappers (try/catch).
// Wrecks are decor ONLY — they never affect terrain, physics, or scoring.
import type { DeathCause } from "./types";

export interface Wreck {
  x: number; // world px (player center at death)
  y: number;
  cause: DeathCause;
  ts: number; // wall-clock stamp, used only for level pruning order
}

export type WreckDB = Record<string, Wreck[]>; // keyed by seedStr ("date+symbol")

export const WRECK_KEY = "cc_wreckage_v1";
export const MAX_PER_LEVEL = 30;
export const MAX_LEVELS = 24;

/** Pure: append a wreck (capped per level) and prune the oldest levels. */
export function recordWreck(db: WreckDB, seedStr: string, wreck: Wreck): WreckDB {
  if (!wreck || !Number.isFinite(wreck.x) || !Number.isFinite(wreck.y)) return db;
  const prev = db[seedStr] ?? [];
  const next: WreckDB = {
    ...db,
    [seedStr]: [...prev, wreck].slice(-MAX_PER_LEVEL),
  };
  // prune levels: keep the MAX_LEVELS most recently fatal
  const keys = Object.keys(next);
  if (keys.length > MAX_LEVELS) {
    const ranked = keys
      .map((k) => ({ k, latest: next[k][next[k].length - 1]?.ts ?? 0 }))
      .sort((a, b) => b.latest - a.latest);
    for (const { k } of ranked.slice(MAX_LEVELS)) delete next[k];
  }
  return next;
}

export function wrecksFor(db: WreckDB, seedStr: string): Wreck[] {
  return db?.[seedStr] ?? [];
}

/** Client storage (never throws — wreck loss is cosmetic). */
export function loadWreckDB(): WreckDB {
  try {
    const raw = localStorage.getItem(WRECK_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as WreckDB;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

export function saveWreckDB(db: WreckDB): void {
  try {
    localStorage.setItem(WRECK_KEY, JSON.stringify(db));
  } catch {
    /* quota/private mode — wreckage is disposable */
  }
}
