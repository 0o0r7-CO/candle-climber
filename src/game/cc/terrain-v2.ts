// V1 visual translation (P2.1 / ART-DIRECTION §2): Platform[] -> deterministic
// decorative terrain entities. RENDER-ONLY by construction:
//  - consumes the SAME Platform[] the engine already simulates (no geometry change,
//    no collision change — decor entities carry no physics)
//  - pure function of (plats, seedStr): no Date.now(), no Math.random()
//  - per-platform PRNG (mulberry32(hash("cc-v2:"+seedStr+":"+i))) so appending
//    World-2 chunks never mutates earlier decor
//  - semantic rule (ART-DIRECTION §1): up/down identity and the walkable cap
//    geometry stay IDENTICAL to the v1 renderer; decor is additive and dark
import type { Platform } from "./types";
import { hashString, mulberry32 } from "./rng";

export interface Vein { x0: number; y0: number; bend: number; a: number; w: number }
export interface Crack { pts: Array<[number, number]>; a: number }
export interface Dot { x: number; y: number; s: number; a: number }
export interface Strand { x: number; len: number; w: number }

export interface SlabDecor {
  i: number; // platform index (slabs[k].i === plats[k].i)
  up: boolean;
  gap: boolean;
  summit: boolean;
  veins: Vein[];    // green bodies: upward lime veins (normalized 0..1 coords)
  crystals: Dot[];  // green caps: tiny lime crystals (x normalized, y unused=cap)
  cracks: Crack[];  // red bodies: ink fracture polylines (normalized)
  embers: Dot[];    // red bodies: ember dots (normalized, lower half)
  spikes: Strand[]; // hanging stalactites from wickTop (px offsets from center)
  roots: Strand[];  // root strands below wickBottom (px offsets from center)
  glow: number;     // 0..1 emission strength for the cap glow
}

export interface TerrainV2 {
  slabs: SlabDecor[]; // index-aligned with plats
  skyPhase: number;   // 0..1 deterministic "time of day" for the sky palette
  ghostScale: number; // background ghost candle size scale
  fogAlpha: number;   // abyss fog strength 0..1
}

const FRAC = 1 / 4294967296;

export function buildTerrainV2(plats: Platform[], seedStr: string): TerrainV2 {
  const skyPhase = hashString("cc-v2-sky:" + seedStr) * FRAC;
  const slabs: SlabDecor[] = plats.map((p) => {
    const rnd = mulberry32(hashString("cc-v2:" + seedStr + ":" + p.i));
    const gap = p.state === "gone" || p.w === 0;
    const bodyH = Math.max(0, p.bodyBottom - p.bodyTop);
    const upWick = Math.max(0, p.bodyTop - p.wickTop);
    const loWick = Math.max(0, p.wickBottom - p.bodyBottom);

    // ---- hanging spikes (upper wick) — dark decor, never interactive ----
    const spikes: Strand[] = [];
    if (!gap && upWick > 14) {
      const n = Math.min(3, Math.max(1, Math.floor(upWick / 26)));
      for (let k = 0; k < n; k++) {
        spikes.push({
          x: (rnd() - 0.5) * p.w * 0.72,
          len: 8 + rnd() * Math.min(14, upWick - 12),
          w: 3 + rnd() * 3,
        });
      }
    }
    // ---- roots (lower wick) ----
    const roots: Strand[] = [];
    if (!gap && loWick > 12) {
      const n = Math.min(3, Math.max(1, Math.floor(loWick / 24)));
      for (let k = 0; k < n; k++) {
        roots.push({
          x: (rnd() - 0.5) * p.w * 0.6,
          len: 8 + rnd() * Math.min(16, loWick - 8),
          w: 2 + rnd() * 2,
        });
      }
    }
    // ---- green material: living stone ----
    const veins: Vein[] = [];
    const crystals: Dot[] = [];
    if (!gap && p.up && bodyH >= 18) {
      const n = 1 + (bodyH > 40 ? 1 : 0) + (rnd() < 0.3 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        veins.push({
          x0: 0.18 + rnd() * 0.64,
          y0: rnd() * 0.3,
          bend: (rnd() - 0.5) * 0.3,
          a: 0.22 + rnd() * 0.26,
          w: 1.4 + rnd() * 1.2,
        });
      }
      if (rnd() < 0.6) {
        crystals.push({ x: (rnd() - 0.5) * 0.7, y: 0, s: 2 + rnd() * 2.5, a: 0.5 + rnd() * 0.4 });
      }
    }
    // ---- red material: charred rock ----
    const cracks: Crack[] = [];
    const embers: Dot[] = [];
    if (!gap && !p.up && bodyH >= 16) {
      const n = 1 + (bodyH > 36 ? 1 : 0) + (rnd() < 0.35 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const pts: Array<[number, number]> = [];
        let cx = 0.2 + rnd() * 0.6;
        let cy = 0.08 + rnd() * 0.25;
        for (let s = 0; s < 3; s++) {
          pts.push([cx, cy]);
          cx += (rnd() - 0.5) * 0.22;
          cy += 0.16 + rnd() * 0.2;
        }
        cracks.push({ pts, a: 0.5 + rnd() * 0.35 });
      }
      const m = 2 + Math.floor(rnd() * 3);
      for (let k = 0; k < m; k++) {
        embers.push({ x: rnd(), y: 0.55 + rnd() * 0.4, s: 1.4 + rnd() * 1.8, a: 0.35 + rnd() * 0.4 });
      }
    }
    return {
      i: p.i,
      up: p.up,
      gap,
      summit: Boolean(p.summit),
      veins, crystals, cracks, embers, spikes, roots,
      glow: p.up ? 0.3 + 0.4 * Math.min(1, Math.max(0, (bodyH - 10) / 70)) : 0.1,
    };
  });
  return {
    slabs,
    skyPhase,
    ghostScale: 2.1 + hashString("cc-v2-ghost:" + seedStr) * FRAC * 0.9,
    fogAlpha: 0.7 + hashString("cc-v2-fog:" + seedStr) * FRAC * 0.3,
  };
}
