// Global daily leaderboard storage.
// - MemoryStore: default, zero-config. Resets on restart — fine for dev/preview.
// - MongoStore:  auto-activated when DATABASE_URL is a mongodb:// or mongodb+srv://
//   URI (MongoDB Atlas M0 via GitHub Student Pack, phase p1). No code changes needed:
//   set the env var and restart; every failure falls back to memory gracefully.
export interface BoardEntry {
  name: string;
  score: number;
  candlesPassed: number;
  bestStreak?: number;
  mutation?: string;
  symbol: string;
  date: string;
  interval?: string; // P3.5: leaderboard boards are PER-TIMEFRAME ("1w" when absent — legacy entries)
  ts: number;
}

export interface BoardStore {
  readonly kind: "memory" | "mongo";
  add(entry: BoardEntry): Promise<number>; // returns global-daily rank (1-based, within entry.interval)
  top(date: string | null, n: number, interval?: string): Promise<BoardEntry[]>;
  /** last connection error when a backing store is down (diagnostics) */
  readonly lastError?: string;
}

/* ---------------------------------- memory --------------------------------- */

// exported for W5 contract tests (P3.5 per-timeframe board separation)
export class MemoryStore implements BoardStore {
  readonly kind = "memory" as const;
  private rows: BoardEntry[] = [];
  private readonly max = 2000;

  async add(entry: BoardEntry): Promise<number> {
    this.rows.push(entry);
    if (this.rows.length > this.max) this.rows.splice(0, this.rows.length - this.max);
    const iv = entry.interval ?? "1w";
    const better = this.rows.filter(
      (r) => r.date === entry.date && (r.interval ?? "1w") === iv && r.score > entry.score,
    ).length;
    return better + 1;
  }

  async top(date: string | null, n: number, interval: string = "1w"): Promise<BoardEntry[]> {
    return this.rows
      .filter((r) => (!date || r.date === date) && (r.interval ?? "1w") === interval)
      .sort((a, b) => b.score - a.score)
      .slice(0, n);
  }
}

/* ----------------------------------- mongo ---------------------------------- */

const MONGO_DB = "candleclimber";
const MONGO_COLL = "scores";

class MongoStore implements BoardStore {
  readonly kind = "mongo" as const;
  lastError: string | undefined;
  private coll: import("mongodb").Collection<BoardEntry> | null = null;
  private connecting: Promise<import("mongodb").Collection<BoardEntry> | null> | null = null;
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
        const coll = client.db(MONGO_DB).collection<BoardEntry>(MONGO_COLL);
        await coll.createIndex({ date: 1, score: -1 });
        this.coll = coll;
        return coll;
      } catch (err) {
        const msg = (err as Error).message;
        console.error("[leaderboard] mongo unavailable, falling back to memory:", msg);
        this.lastError = msg;
        this.disabled = true;
        return null;
      }
    })();
    return this.connecting;
  }

  async add(entry: BoardEntry): Promise<number> {
    const coll = await this.connect();
    if (!coll) return 1; // unreachable in practice — route falls back to memory store
    await coll.insertOne({ ...entry }); // BoardEntry has no _id field → driver auto-generates
    // rank within the entry's own timeframe board ("no board mixing", P3.5);
    // legacy docs (no interval field) count as "1w"
    const iv = entry.interval ?? "1w";
    const ivq = iv === "1w" ? { $or: [{ interval: "1w" }, { interval: { $exists: false } }] } : { interval: iv };
    const better = await coll.countDocuments({ date: entry.date, ...ivq, score: { $gt: entry.score } });
    return better + 1;
  }

  async top(date: string | null, n: number, interval: string = "1w"): Promise<BoardEntry[]> {
    const coll = await this.connect();
    if (!coll) return [];
    // legacy entries predate the interval field — they are "1w" boards
    const ivq = interval === "1w"
      ? { $or: [{ interval: "1w" }, { interval: { $exists: false } }] }
      : { interval };
    const q = { ...(date ? { date } : {}), ...ivq };
    return coll.find(q).sort({ score: -1 }).limit(n).toArray();
  }
}

/* --------------------------------- singleton -------------------------------- */

// Memoize BOTH stores: a fresh MongoStore per request would mean a fresh MongoClient
// per request (Atlas M0 caps connections, and the per-instance 'disabled' circuit-
// breaker would reset every call — AUDIT finding F3).
let memoryFallback: MemoryStore | null = null;
let mongoStore: MongoStore | null = null;

export function getBoard(): BoardStore {
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("mongodb://") || url.startsWith("mongodb+srv://")) {
    if (!mongoStore) mongoStore = new MongoStore();
    return mongoStore;
  }
  if (!memoryFallback) memoryFallback = new MemoryStore();
  return memoryFallback;
}
