import { openDatabaseSync, deleteDatabaseAsync } from "expo-sqlite"
import type { SQLiteDatabase } from "expo-sqlite"
import type { StorageAdapter } from "@tanstack/offline-transactions"

// The @tanstack/offline-transactions outbox lives in its OWN SQLite database,
// deliberately separate from the Electric collections DB (buildinlime.sqlite).
// Sharing a connection let outbox writes (outbox.remove/update) queue behind
// the persistence layer's multi-statement transactions and deadlock — a hung
// runExecution() then permanently jams the executor's `isExecuting` guard, so
// nothing ever drains. A dedicated file gives the outbox a single, uncontended
// writer.
const OUTBOX_DB_NAME = "buildinlime-outbox.sqlite"

let _db: SQLiteDatabase | null = null

function getOutboxDb(): SQLiteDatabase {
  if (_db) return _db
  const db = openDatabaseSync(OUTBOX_DB_NAME)
  db.execSync(`
    PRAGMA journal_mode=WAL;
    PRAGMA busy_timeout=5000;
  `)
  db.execSync(`
    CREATE TABLE IF NOT EXISTS offline_outbox (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `)
  _db = db
  return db
}

// StorageAdapter for @tanstack/offline-transactions. Without a custom adapter
// the library's probe only checks IndexedDB/localStorage — both absent in
// React Native — and the executor silently degrades to `online-only` mode.
export const sqliteStorageAdapter: StorageAdapter = {
  async get(key) {
    const row = await getOutboxDb().getFirstAsync<{ value: string }>(
      `SELECT value FROM offline_outbox WHERE key = ?`,
      [key],
    )
    return row?.value ?? null
  },

  async set(key, value) {
    await getOutboxDb().runAsync(
      `INSERT INTO offline_outbox (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value],
    )
  },

  async delete(key) {
    await getOutboxDb().runAsync(`DELETE FROM offline_outbox WHERE key = ?`, [key])
  },

  async keys() {
    const rows = await getOutboxDb().getAllAsync<{ key: string }>(
      `SELECT key FROM offline_outbox`,
    )
    return rows.map((r) => r.key)
  },

  async clear() {
    await getOutboxDb().runAsync(`DELETE FROM offline_outbox`)
  },
}

// Closes and deletes the outbox database. Called on sign-out (AFTER
// disposeOfflineExecutor(), so nothing is writing it) — the outbox is
// user-scoped and must not leak pending mutations into the next session.
export async function disposeOutboxDb(): Promise<void> {
  if (!_db) return
  const db = _db
  _db = null
  try {
    db.closeSync()
    await deleteDatabaseAsync(OUTBOX_DB_NAME)
  } catch {
    // Best-effort — never block sign-out.
  }
}
