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
  if (sqlite3.oo1.OpfsDb) {
    try {
      rawDb = new sqlite3.oo1.OpfsDb("/zhinote.db");
      console.log("[Zhinote] SQLite initialized with OPFS persistence");
    } catch (e) {
      console.warn("[Zhinote] OPFS not available, using in-memory DB:", e);
      rawDb = new sqlite3.oo1.DB(":memory:");
    }
  } else {
    console.warn("[Zhinote] OPFS not supported, using in-memory DB");
    rawDb = new sqlite3.oo1.DB(":memory:");
  }

  // Wrap the raw db with a consistent API
  const db: SqliteDb = {
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

  // Create all tables
  db.run(CREATE_TABLES_SQL);

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

  return db;
}
