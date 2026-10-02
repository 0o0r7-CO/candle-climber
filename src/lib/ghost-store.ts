// Global ghost storage (P7.2) — mirrors leaderboard-store.ts exactly:
// - MemoryGhostStore: default, zero-config. Resets on restart — fine for dev.
// - MongoGhostStore: auto-activated when DATABASE_URL is a mongodb:// URI.
//   Every failure falls back to memory gracefully (circuit breaker, F3 pattern).
// Key insight: ghosts are per-TERRAIN (symbol|date|interval), keep the best
// GHOSTS_PER_TERRAIN by candlesPassed, and expire after GHOST_TTL_DAYS (a
// daily terrain's ghosts are worthless once the daily board rotates).
import {
  GHOSTS_PER_TERRAIN, GHOSTS_SERVED, type GhostEntry,
} from "@/game/cc/ghost";

export const GHOST_TTL_DAYS = 7;

export interface GhostStore {
  readonly kind: "memory" | "mongo";
  add(entry: GhostEntry): Promise<void>;
  /** Best ghosts for one terrain key, champion first. */
  top(symbol: string, date: string, interval: string): Promise<GhostEntry[]>;
  /** last connection error when a backing store is down (diagnostics) */
  readonly lastError?: string;
}

export function ghostKey(symbol: string, date: string, interval: string): string {
  return `${symbol}|${date}|${interval}`;
}

/* ---------------------------------- memory --------------------------------- */

// exported for contract tests (same pattern as MemoryStore for W5 tests)
export class MemoryGhostStore implements GhostStore {
  readonly kind = "memory" as const;
  private byKey = new Map<string, GhostEntry[]>();

  async add(entry: GhostEntry): Promise<void> {
    const k = ghostKey(entry.symbol, entry.date, entry.interval);
    const rows = this.byKey.get(k) ?? [];
    rows.push(entry);
    rows.sort((a, b) => b.candlesPassed - a.candlesPassed || a.ts - b.ts);
    this.byKey.set(k, rows.slice(0, GHOSTS_PER_TERRAIN));
  }

  async top(symbol: string, date: string, interval: string): Promise<GhostEntry[]> {
    return (this.byKey.get(ghostKey(symbol, date, interval)) ?? [])
      .slice(0, GHOSTS_SERVED);
  }
}

/* ----------------------------------- mongo ---------------------------------- */

const MONGO_DB = "candleclimber";
const MONGO_COLL = "ghosts";

type GhostDoc = GhostEntry & { _id?: unknown };

class MongoGhostStore implements GhostStore {
  readonly kind = "mongo" as const;
  lastError: string | undefined;
  private coll: import("mongodb").Collection<GhostDoc> | null = null;
  private connecting: Promise<import("mongodb").Collection<GhostDoc> | null> | null = null;
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
        const coll = client.db(MONGO_DB).collection<GhostDoc>(MONGO_COLL);
        await coll.createIndex({ symbol: 1, date: 1, interval: 1, candlesPassed: -1 });
        // daily-terrain ghosts rotate out with the terrain itself
        await coll.createIndex({ ts: 1 }, { expireAfterSeconds: GHOST_TTL_DAYS * 86_400 });
        this.coll = coll;
        return coll;
      } catch (err) {
        const msg = (err as Error).message;
        console.error("[ghosts] mongo unavailable, falling back to memory:", msg);
        this.lastError = msg;
        this.disabled = true;
        return null;
      }
    })();
    return this.connecting;
  }

  async add(entry: GhostEntry): Promise<void> {
    const coll = await this.connect();
    if (!coll) return; // unreachable in practice — route falls back to memory store
    await coll.insertOne({ ...entry });
    // keep only the global top-N for this terrain (delete the rest)
    const keep = await coll
      .find({ symbol: entry.symbol, date: entry.date, interval: entry.interval })
      .sort({ candlesPassed: -1, ts: 1 })
      .skip(GHOSTS_PER_TERRAIN)
      .project({ _id: 1 })
      .toArray();
    if (keep.length > 0) {
      await coll.deleteMany({
        symbol: entry.symbol, date: entry.date, interval: entry.interval,
        _id: { $in: keep.map((d) => d._id) },
      });
    }
  }

  async top(symbol: string, date: string, interval: string): Promise<GhostEntry[]> {
    const coll = await this.connect();
    if (!coll) return [];
    const docs = await coll
      .find({ symbol, date, interval })
      .sort({ candlesPassed: -1, ts: 1 })
      .limit(GHOSTS_SERVED)
      .toArray();
    return docs.map(({ _id, ...e }) => e as GhostEntry);
  }
}

/* --------------------------------- singleton -------------------------------- */

// Memoized exactly like getBoard() — a fresh store per request would mean a
// fresh MongoClient per request (Atlas M0 caps connections; AUDIT F3).
let memoryFallback: MemoryGhostStore | null = null;
let mongoStore: MongoGhostStore | null = null;

export function getGhostStore(): GhostStore {
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("mongodb://") || url.startsWith("mongodb+srv://")) {
    if (!mongoStore) mongoStore = new MongoGhostStore();
    return mongoStore;
  }
  if (!memoryFallback) memoryFallback = new MemoryGhostStore();
  return memoryFallback;
}
