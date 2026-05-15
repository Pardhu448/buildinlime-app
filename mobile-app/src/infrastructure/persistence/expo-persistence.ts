import { openDatabaseSync, deleteDatabaseAsync } from "expo-sqlite"
import type { SQLiteDatabase } from "expo-sqlite"
import {
  createExpoSQLitePersistence,
  persistedCollectionOptions,
} from "@tanstack/expo-db-sqlite-persistence"
import type { ExpoSQLiteDatabaseLike } from "@tanstack/expo-db-sqlite-persistence"

export { persistedCollectionOptions }

const DATABASE_NAME = "buildinlime.sqlite"

type PersistenceTrio = {
  database: SQLiteDatabase
  persistence: ReturnType<typeof createExpoSQLitePersistence>
}

let _trio: PersistenceTrio | null = null

export function getPersistence(): PersistenceTrio {
  if (_trio) return _trio
  if (__DEV__) console.log(`[SQLite] Initializing persistence (db=${DATABASE_NAME})…`)
  const t0 = Date.now()

  const database = openDatabaseSync(DATABASE_NAME)

  // WAL mode allows concurrent reads with a single writer. busy_timeout makes
  // a writer that can't immediately acquire the lock WAIT (up to 5s) instead
  // of failing with SQLITE_BUSY ("database is locked") — needed because the
  // Electric sync persistence and the offline-transactions outbox both write
  // this DB and can contend.
  database.execSync(`
    PRAGMA journal_mode=WAL;
    PRAGMA busy_timeout=5000;
  `)

  const persistence = createExpoSQLitePersistence({
    database: database as unknown as ExpoSQLiteDatabaseLike,
  })

  database.execSync(`
    CREATE TABLE IF NOT EXISTS pending_attachments (
      resource_id TEXT PRIMARY KEY NOT NULL,
      uri TEXT NOT NULL,
      name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      buildunit_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      createdby_id TEXT NOT NULL,
      message_id TEXT,
      status TEXT NOT NULL,
      scheduled_at TEXT,
      error_message TEXT
    );
  `)

  if (__DEV__) console.log(`[SQLite] Persistence ready in ${Date.now() - t0}ms`)
  _trio = { database, persistence }
  return _trio
}

// Wipes the SQLite database so the next user logging in on the same device
// does not see the previous user's cached rows on first paint. Best-effort
// — never blocks sign-out.
//
// EXPECTED NOISE: closing/deleting the DB here can race Electric sync writes
// still in flight from collections that haven't been GC'd yet, producing a
// one-off "Failed to persist wrapped sync transaction: no such table:
// applied_tx" warning. It is harmless — the DB is being destroyed anyway and
// a fresh login rebuilds everything. Fully eliminating it means aborting
// every collection's sync stream before this runs (deliberately not done).
export async function disposePersistence(): Promise<void> {
  if (!_trio) return
  if (__DEV__) console.log(`[SQLite] Disposing persistence…`)
  const trio = _trio
  _trio = null
  try {
    trio.database.closeSync()
    await deleteDatabaseAsync(DATABASE_NAME)
    if (__DEV__) console.log(`[SQLite] Persistence disposed, database file removed`)
  } catch {
    if (__DEV__) console.warn(`[SQLite] Dispose failed (best-effort)`)
  }
}
