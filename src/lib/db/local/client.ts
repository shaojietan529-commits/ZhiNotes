import { CREATE_TABLES_SQL } from "./schema";
import { DEFAULT_OWNER_ID } from "@/lib/utils/id";
import { nowISO } from "@/lib/utils/dates";

// Wrapper around the raw SQLite WASM database that normalizes the API
export interface SqliteDb {
  run: (sql: string, bind?: unknown[]) => void;
  query: (sql: string, bind?: unknown[]) => Record<string, unknown>[];
}

let dbInstance: SqliteDb | null = null;
let initPromise: Promise<SqliteDb> | null = null;
const LOCAL_STORAGE_DB_NAME = "local";
const LOCAL_CACHE_BYPASS_KEY = "zhinote.localCache.skipPersistentUntil";
const LOCAL_CACHE_BYPASS_MS = 10 * 60 * 1000;
const CREATE_TABLES_WITHOUT_DAILY_DATE_INDEX = CREATE_TABLES_SQL.replace(
  /\s*CREATE INDEX IF NOT EXISTS idx_pages_daily_date ON pages\(daily_date_key, updated_at DESC\);\s*/,
  "\n"
);

export async function getDb(): Promise<SqliteDb> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = initializeDb();
  dbInstance = await initPromise;
  return dbInstance;
}

async function initializeDb(): Promise<SqliteDb> {
  const { default: sqlite3InitModule } = await import(
    "@sqlite.org/sqlite-wasm"
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sqlite3 = await (sqlite3InitModule as any)({
    print: console.log,
    printErr: console.error,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rawDb: any;
  const createMemoryDb = () => new sqlite3.oo1.DB(":memory:");
  const createFallbackDb = () => {
    if (shouldBypassPersistentLocalCache()) {
      console.warn("[Zhinote] Persistent local cache bypassed, using in-memory DB");
      return createMemoryDb();
    }
    if (sqlite3.oo1.JsStorageDb) {
      try {
        console.warn("[Zhinote] OPFS not available, using localStorage DB");
        return new sqlite3.oo1.JsStorageDb(LOCAL_STORAGE_DB_NAME);
      } catch (e) {
        console.warn("[Zhinote] localStorage DB not available, using in-memory DB:", e);
      }
    }
    return createMemoryDb();
  };

  if (sqlite3.oo1.OpfsDb) {
    try {
      rawDb = new sqlite3.oo1.OpfsDb("/zhinote.db");
      console.log("[Zhinote] SQLite initialized with OPFS persistence");
    } catch (e) {
      console.warn("[Zhinote] OPFS initialization failed:", e);
      rawDb = createFallbackDb();
    }
  } else {
    rawDb = createFallbackDb();
  }

  let db = wrapRawDb(rawDb);
  try {
    installLocalSchema(db);
  } catch (e) {
    console.warn(
      "[Zhinote] Local SQLite cache schema failed, resetting rebuildable cache:",
      e
    );
    tryCloseLocalCache(rawDb, true);
    if (resetPersistentLocalCache(sqlite3)) {
      try {
        rawDb = new sqlite3.oo1.JsStorageDb(LOCAL_STORAGE_DB_NAME);
        db = wrapRawDb(rawDb);
        installLocalSchema(db);
        clearPersistentLocalCacheBypass();
        return db;
      } catch (retryError) {
        console.warn(
          "[Zhinote] Local SQLite cache reset failed, using rebuildable in-memory cache:",
          retryError
        );
      }
    }
    markPersistentLocalCacheBypass();
    db = wrapRawDb(createMemoryDb());
    installLocalSchema(db);
  }

  return db;
}

// Wrap the raw db with a consistent API.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrapRawDb(rawDb: any): SqliteDb {
  return {
    run(sql: string, bind?: unknown[]) {
      if (bind && bind.length > 0) {
        rawDb.exec({ sql, bind });
      } else {
        rawDb.exec(sql);
      }
    },
    query(sql: string, bind?: unknown[]): Record<string, unknown>[] {
      const opts: Record<string, unknown> = {
        sql,
        returnValue: "resultRows",
        rowMode: "object",
      };
      if (bind && bind.length > 0) {
        opts.bind = bind;
      }
      return rawDb.exec(opts) as Record<string, unknown>[];
    },
  };
}

function installLocalSchema(db: SqliteDb) {
  // Create all tables
  db.run(CREATE_TABLES_WITHOUT_DAILY_DATE_INDEX);

  // Additive, non-destructive migrations for databases created before a column
  // existed. Each step only ADDs a nullable column if it is missing, so no data
  // is ever dropped or rewritten.
  ensureColumn(db, "pages", "properties", "TEXT");
  ensureColumn(db, "pages", "daily_date_key", "TEXT");
  ensureIndex(
    db,
    "idx_pages_daily_date",
    "pages(daily_date_key, updated_at DESC)"
  );

  // Ensure the default solo user exists
  const users = db.query(
    "SELECT id FROM users WHERE id = ?",
    [DEFAULT_OWNER_ID]
  );
  if (users.length === 0) {
    const now = nowISO();
    db.run(
      "INSERT INTO users (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
      [DEFAULT_OWNER_ID, "Me", now, now]
    );
  }
}

// Adds a column to an existing table only when it is not already present.
// This keeps older local databases working without dropping any rows.
function ensureColumn(
  db: SqliteDb,
  table: string,
  column: string,
  type: string
) {
  try {
    const columns = db.query(`PRAGMA table_info(${table})`);
    const exists = columns.some((row) => row.name === column);
    if (!exists) {
      db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    }
  } catch (e) {
    console.warn(`[Zhinote] ensureColumn ${table}.${column} failed:`, e);
  }
}

function ensureIndex(db: SqliteDb, name: string, target: string) {
  try {
    db.run(`CREATE INDEX IF NOT EXISTS ${name} ON ${target}`);
  } catch (e) {
    console.warn(`[Zhinote] ensureIndex ${name} failed:`, e);
  }
}

// The browser database is a rebuildable cache. If a persisted cache is corrupt
// or too old to migrate, do not keep blocking app startup on it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tryCloseLocalCache(rawDb: any, unlink: boolean) {
  try {
    rawDb?.close?.(unlink ? { unlink: true } : undefined);
  } catch {
    // Best-effort cache close only.
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resetPersistentLocalCache(sqlite3: any): boolean {
  try {
    const clearStorage = sqlite3.oo1.JsStorageDb?.clearStorage;
    if (typeof clearStorage !== "function") return false;
    const cleared = clearStorage(LOCAL_STORAGE_DB_NAME);
    return cleared >= 0;
  } catch (error) {
    console.warn("[Zhinote] Failed to clear persistent local cache:", error);
    return false;
  }
}

function shouldBypassPersistentLocalCache(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const until = Number(window.localStorage.getItem(LOCAL_CACHE_BYPASS_KEY));
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

function markPersistentLocalCacheBypass() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      LOCAL_CACHE_BYPASS_KEY,
      String(Date.now() + LOCAL_CACHE_BYPASS_MS)
    );
  } catch {
    // If even this marker cannot be written, the in-memory cache still works.
  }
}

function clearPersistentLocalCacheBypass() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LOCAL_CACHE_BYPASS_KEY);
  } catch {
    // Best-effort cache marker cleanup only.
  }
}
