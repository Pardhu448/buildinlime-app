import { openDatabaseSync, deleteDatabaseAsync } from "expo-sqlite"
import type { SQLiteDatabase } from "expo-sqlite"
import * as SecureStore from "expo-secure-store"
import {
  createExpoSQLitePersistence,
  persistedCollectionOptions,
} from "@tanstack/expo-db-sqlite-persistence"
import type { ExpoSQLiteDatabaseLike } from "@tanstack/expo-db-sqlite-persistence"

export { persistedCollectionOptions }

const DATABASE_NAME = "buildinlime.sqlite"

// Records which user the local database currently holds data for. Lets a new
// sign-in detect that the DB belongs to someone else and wipe it — see
// ensureCleanPersistenceForUser.
const PERSISTENCE_OWNER_KEY = "buildinlime.persistence_owner"

type PersistenceTrio = {
  database: SQLiteDatabase
  persistence: ReturnType<typeof createExpoSQLitePersistence>
}

let _trio: PersistenceTrio | null = null

// Guarantee the local database belongs to `userId` BEFORE any collection opens
// it (call at the very start of bootstrap). If the recorded owner differs, wipe
// the database first.
//
// This is the self-healing counterpart to disposePersistence(): sign-out tries to
// delete the DB, but that delete can race in-flight Electric sync writes and its
// failure is swallowed. If it doesn't fully clear, the NEXT user's collections
// restore the previous user's rows AND resume from the previous user's Electric
// sync offsets — and a stale offset makes Electric report "up-to-date" and never
// re-deliver the new user's rows. That surfaced as missing build units (and other
// membership-scoped data) at random after signing in as a different user: empty
// membership ids → the owner-escape shapes return nothing for a non-owner.
//
// Wiping on the way IN cannot be skipped by a crash or a raced sign-out. Same user
// (app restart / session restore) is a no-op, so the offline cache is preserved.
export async function ensureCleanPersistenceForUser(userId: string): Promise<void> {
  let owner: string | null = null
  try {
    owner = await SecureStore.getItemAsync(PERSISTENCE_OWNER_KEY)
  } catch {
    // Unreadable marker → treat as unknown owner and wipe to be safe.
  }
  if (owner === userId) return

  if (__DEV__) {
    console.log(
      `[SQLite] Persistence owner (${owner ?? `none`}) != current user — wiping for a clean slate`,
    )
  }

  // Close any handle this process still holds so the file can be deleted.
  if (_trio) {
    try {
      _trio.database.closeSync()
    } catch {
      // best-effort
    }
    _trio = null
  }
  try {
    await deleteDatabaseAsync(DATABASE_NAME)
  } catch {
    // No existing file (e.g. already deleted on sign-out) — fine.
  }
  try {
    await SecureStore.setItemAsync(PERSISTENCE_OWNER_KEY, userId)
  } catch {
    // If we can't record the owner the worst case is a redundant wipe next login.
    if (__DEV__) console.warn(`[SQLite] Failed to record persistence owner`)
  }
}

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

  // NOTE: the upload manager's `pending_attachments` table deliberately lives
  // in its OWN database file (see pending-uploads-db.ts), not here — sharing
  // this connection caused "database is locked" failures against Electric's
  // sync-persistence transactions.

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
