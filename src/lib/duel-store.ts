// Global duel storage (P7.3) — mirrors ghost-store.ts / leaderboard-store.ts:
// - MemoryDuelStore: default, zero-config. Resets on restart — fine for dev.
// - MongoDuelStore: auto-activated when DATABASE_URL is a mongodb:// URI.
//   Every failure falls back to memory gracefully (circuit breaker, F3 pattern).
// Key insight: duels are addressed by a short shareable CODE (the invitation
// IS the key), expire after DUEL_TTL_DAYS (a daily terrain's duel rotates out
// with the terrain), and are capped per terrain to stop store bloat.
import { createRandomCode } from "@/lib/code-gen";
import { DUEL_TTL_DAYS, DUEL_CODE_LEN, duelExpired, type DuelChallenge } from "@/game/cc/duel";

/** Keep at most this many LIVE challenges per terrain key (bloat guard). */
export const DUELS_PER_TERRAIN = 50;

export interface DuelStore {
  readonly kind: "memory" | "mongo";
  /** Persist a challenge; assigns + returns its unique code. */
  create(ch: Omit<DuelChallenge, "code">): Promise<string>;
  /** Challenge by code — null when unknown/expired. */
  get(code: string): Promise<DuelChallenge | null>;
  /** last connection error when a backing store is down (diagnostics) */
  readonly lastError?: string;
}

export function duelKey(symbol: string, date: string, interval: string): string {
  return `${symbol}|${date}|${interval}`;
}

/* ---------------------------------- memory --------------------------------- */

// exported for contract tests (same pattern as MemoryGhostStore)
export class MemoryDuelStore implements DuelStore {
  readonly kind = "memory" as const;
  private byCode = new Map<string, DuelChallenge>();

  async create(ch: Omit<DuelChallenge, "code">): Promise<string> {
    // code collision retry — 30-char^6 space, effectively never loops
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = createRandomCode(DUEL_CODE_LEN);
      if (this.byCode.has(code)) continue;
      this.byCode.set(code, { ...ch, code });
      this.pruneTerrain(duelKey(ch.symbol, ch.date, ch.interval));
      return code;
    }
    // unreachable in practice; fail loudly rather than return a duplicate
    throw new Error("duel code space exhausted");
  }

  async get(code: string): Promise<DuelChallenge | null> {
    const ch = this.byCode.get(code) ?? null;
    if (!ch) return null;
    if (duelExpired(ch)) {
      this.byCode.delete(code);
      return null;
    }
    return ch;
  }

  /** Evict expired challenges + cap per-terrain count (oldest first). */
  private pruneTerrain(key: string) {
    const now = Date.now();
    const rows = [...this.byCode.entries()].filter(
      ([, c]) => duelKey(c.symbol, c.date, c.interval) === key,
    );
    const live = rows.filter(([, c]) => !duelExpired(c, now));
    for (const [code, c] of rows) if (duelExpired(c, now)) this.byCode.delete(code);
    live
      .sort((a, b) => a[1].ts - b[1].ts)
      .slice(0, Math.max(0, live.length - DUELS_PER_TERRAIN))
      .forEach(([code]) => this.byCode.delete(code));
  }
}

/* ----------------------------------- mongo ---------------------------------- */

const MONGO_DB = "candleclimber";
const MONGO_COLL = "duels";

type DuelDoc = DuelChallenge & { _id?: unknown };

class MongoDuelStore implements DuelStore {
  readonly kind = "mongo" as const;
  lastError: string | undefined;
  private coll: import("mongodb").Collection<DuelDoc> | null = null;
  private connecting: Promise<import("mongodb").Collection<DuelDoc> | null> | null = null;
  private disabled = false;

  private async connect() {
    if (this.coll) return this.coll;
    if (this.disabled) return null;
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      try {
        const { MongoClient } = await import("mongodb");
        const client = new MongoClient(process.env.DATABASE_URL as string, {
          serverSelectionTimeoutMS: 4000,
        });
        await client.connect();
        const coll = client.db(MONGO_DB).collection<DuelDoc>(MONGO_COLL);
        // the code IS the primary key (the invitation is the address)
        await coll.createIndex({ code: 1 }, { unique: true });
        // find-a-terrain's live duels (bloat guard bookkeeping)
        await coll.createIndex({ symbol: 1, date: 1, interval: 1, ts: 1 });
        // daily-terrain duels rotate out with the terrain itself
        await coll.createIndex({ ts: 1 }, { expireAfterSeconds: DUEL_TTL_DAYS * 86_400 });
        this.coll = coll;
        return coll;
      } catch (err) {
        const msg = (err as Error).message;
        console.error("[duels] mongo unavailable, falling back to memory:", msg);
        this.lastError = msg;
        this.disabled = true;
        return null;
      }
    })();
    return this.connecting;
  }

  async create(ch: Omit<DuelChallenge, "code">): Promise<string> {
    const coll = await this.connect();
    if (!coll) return memoryCreate(ch); // unreachable in practice — route falls back
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = createRandomCode(DUEL_CODE_LEN);
      try {
        await coll.insertOne({ ...ch, code });
        return code;
      } catch (err) {
        // duplicate key = the one expected collision; anything else is fatal
        if ((err as { code?: number }).code !== 11000) throw err;
      }
    }
    throw new Error("duel code space exhausted");
  }

  async get(code: string): Promise<DuelChallenge | null> {
    const coll = await this.connect();
    if (!coll) return memoryGet(code);
    const doc = await coll.findOne({ code });
    if (!doc) return null;
    const { _id, ...ch } = doc as DuelDoc;
    return ch;
  }
}

/* --------------------------------- singleton -------------------------------- */

// Memoized exactly like getBoard()/getGhostStore() — a fresh store per request
// would mean a fresh MongoClient per request (Atlas M0 caps connections; F3).
let memoryFallback: MemoryDuelStore | null = null;
let mongoStore: MongoDuelStore | null = null;

export function getDuelStore(): DuelStore {
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("mongodb://") || url.startsWith("mongodb+srv://")) {
    if (!mongoStore) mongoStore = new MongoDuelStore();
    return mongoStore;
  }
  if (!memoryFallback) memoryFallback = new MemoryDuelStore();
  return memoryFallback;
}

/* ------------------- memory fallback shims (mongo down) -------------------- */

function memoryCreate(ch: Omit<DuelChallenge, "code">): Promise<string> {
  if (!memoryFallback) memoryFallback = new MemoryDuelStore();
  return memoryFallback.create(ch);
}

function memoryGet(code: string): Promise<DuelChallenge | null> {
  if (!memoryFallback) memoryFallback = new MemoryDuelStore();
  return memoryFallback.get(code);
}
