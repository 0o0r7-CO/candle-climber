// Candle Climber — core types
export interface Candle {
  t: number; // open time (ms)
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  /** Volume (base asset), when the feed provides it (binance/stooq). Absent
   *  for synthetic/derived terrain — weather fog falls back to a baseline.
   *  Optional since P2.3; JSON.stringify drops undefined, so candle JSON and
   *  run-token fingerprints stay stable for feeds without volume. */
  v?: number;
}

export interface SeedInfo {
  date: string; // UTC YYYY-MM-DD
  symbol: string; // e.g. BTCUSDT / TSLA / launch ticker
  interval: string; // e.g. 1w; "derived" for vibe-launch terrain
  source: 'binance' | 'stooq' | 'vibe-launch' | 'synthetic';
}

export interface CandleData {
  seed: SeedInfo;
  candles: Candle[];
  /** HMAC attestation from /api/candles binding symbol+date+terrain.
   *  Absent for synthetic fallback terrain — those runs are unscored. */
  runToken?: string;
}

export interface Platform {
  i: number; // candle index
  x: number; // world x (left edge)
  w: number; // width
  y: number; // top y (world, y grows downward)
  bodyTop: number;
  bodyBottom: number;
  wickTop: number;
  wickBottom: number;
  up: boolean; // green candle
  crumble: boolean; // red candles crumble
  state: 'solid' | 'crumbling' | 'gone';
  crumbleT: number; // seconds since crumble started
  passed: boolean; // camera already passed it
  /** W4 graduation arc: the FINAL platform of the daily level is the summit —
   *  landing on it (or passing its x) graduates the run. Purely derived from
   *  the seed-derived platform list, so it stays deterministic. */
  summit?: boolean;
}

export interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string;
}

export type DeathCause = 'fell' | 'crumbled' | 'wicked';

export interface RunResult {
  score: number;
  candlesPassed: number;
  bestStreak: number;
  /** Absent while the run is still live (e.g. the GRADUATED snapshot). */
  cause?: DeathCause;
  candleIndex: number;
  /** W4 graduation arc: milestone flags carried into the death card + UI. */
  graduated?: boolean;
  world2?: boolean;
}
