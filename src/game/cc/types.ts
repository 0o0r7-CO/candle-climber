// Candle Climber — core types
export interface Candle {
  t: number; // open time (ms)
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
}

export interface SeedInfo {
  date: string; // UTC YYYY-MM-DD
  symbol: string; // e.g. BTCUSDT
  interval: string; // e.g. 1w
  source: 'binance' | 'synthetic';
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
  cause: DeathCause;
  candleIndex: number;
}
