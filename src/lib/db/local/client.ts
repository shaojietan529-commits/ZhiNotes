import { CREATE_TABLES_SQL } from "./schema";
import { DEFAULT_OWNER_ID } from "@/lib/utils/id";
import { nowISO } from "@/lib/utils/dates";

export type SqliteDb = {
  exec: (sql: string, bind?: unknown[]) => void;
  selectObjects: (sql: string, bind?: unknown[]) => Record<string, unknown>[];
};

let dbInstance: SqliteDb | null = null;
let initPromise: Promise<SqliteDb> | null = null;

export async function getDb(): Promise<SqliteDb> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = initializeDb();
  dbInstance = await initPromise;
  return dbInstance;
}

async function initializeDb(): Promise<SqliteDb> {
  // Dynamic import to avoid SSR issues — SQLite WASM only runs in browser
  const { default: sqlite3InitModule } = await import(
    "@sqlite.org/sqlite-wasm"
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sqlite3 = await (sqlite3InitModule as any)({
    print: console.log,
    printErr: console.error,
  });

  // Try OPFS first for persistent storage, fall back to in-memory
  let db: SqliteDb;
  if (sqlite3.oo1.OpfsDb) {
    try {
      db = new sqlite3.oo1.OpfsDb("/zhinotes.db") as unknown as SqliteDb;
      console.log("[ZhiNotes] SQLite initialized with OPFS persistence");
    } catch (e) {
      console.warn("[ZhiNotes] OPFS not available, using in-memory DB:", e);
      db = new sqlite3.oo1.DB(":memory:") as unknown as SqliteDb;
    }
  } else {
    console.warn("[ZhiNotes] OPFS not supported, using in-memory DB");
    db = new sqlite3.oo1.DB(":memory:") as unknown as SqliteDb;
  }

  // Create all tables
  db.exec(CREATE_TABLES_SQL);

  // Ensure the default solo user exists
  const users = db.selectObjects(
    "SELECT id FROM users WHERE id = ?",
    [DEFAULT_OWNER_ID]
  );
  if (users.length === 0) {
    const now = nowISO();
    db.exec(
      "INSERT INTO users (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
      [DEFAULT_OWNER_ID, "Me", now, now]
    );
  }

  return db;
}
