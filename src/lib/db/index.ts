import "server-only";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export type DB = BetterSQLite3Database<typeof schema>;

// Survive Next.js dev hot-reload: keep the handle on globalThis.
const globalForDb = globalThis as unknown as { __natalieDb?: DB };

function createDb(): DB {
  const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "natalie.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db;
}

export function getDb(): DB {
  if (!globalForDb.__natalieDb) {
    globalForDb.__natalieDb = createDb();
  }
  return globalForDb.__natalieDb;
}

/** Test hook: reset the cached connection (e.g. after switching DATABASE_PATH). */
export function resetDbForTests(): void {
  globalForDb.__natalieDb = undefined;
}
