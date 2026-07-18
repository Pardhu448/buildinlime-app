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

// Records which user AND WHICH SESSION the local database currently holds data
// for, as `${userId}:${sessionId}`. Lets a new sign-in detect that the DB
// belongs to someone else — or to an older login of the same person — and wipe
// it. See ensureCleanPersistenceForUser.
//
// The sessionId half is what makes a SAME-USER re-login wipe. The marker used to
// be the user id alone, which was cleared on sign-out so that path was covered;
// but a sign-out is not the only way to end up back at the login screen. An app
// kill or an expired session drops you there with the marker still intact and
// still matching, so the wipe was skipped and a stale Electric offset survived
// the re-login. A fresh login always mints a new session row, so keying on it
// closes that path while leaving genuine session-restore (same session, app
// restart) a no-op that preserves the offline cache.
const PERSISTENCE_OWNER_KEY = "buildinlime.persistence_owner"

const ownerMarker = (userId: string, sessionId: string) => `${userId}:${sessionId}`

type PersistenceTrio = {
  database: SQLiteDatabase
  persistence: ReturnType<typeof createExpoSQLitePersistence>
}

let _trio: PersistenceTrio | null = null

// Guarantee the local database belongs to THIS login BEFORE any collection opens
// it (call at the very start of bootstrap). If the recorded owner differs, wipe
// the database first.
//
// This is the self-healing counterpart to disposePersistence(): sign-out tries to
// delete the DB, but that delete can race in-flight Electric sync writes and its
// failure is swallowed. If it doesn't fully clear, the next session's collections
// restore the previous rows AND resume from the previous Electric sync offsets —
// and a stale offset makes Electric report "up-to-date" and never re-deliver the
// rows. That surfaced as missing build units (and other membership-scoped data):
// empty membership ids → the owner-escape shapes return nothing for a non-owner.
//
// Wiping on the way IN cannot be skipped by a crash or a raced sign-out, and
// keying on the session id (not just the user id) means it cannot be skipped by
// a re-login that never went through sign-out either. Session RESTORE — the same
// session after an app restart — still matches and is a no-op, so the offline
// cache survives a restart, which is the whole point of persisting it.
export async function ensureCleanPersistenceForUser(
  userId: string,
  sessionId: string,
): Promise<void> {
  // No session id → we cannot tell this login apart from the last one, so the
  // safe reading is "unknown login": wipe, and store nothing that a later launch
  // could match against. Costs a redundant re-sync; never silently reuses a
  // possibly-stale store. (`${userId}:` must NOT be written here — it would
  // match on the next launch and reinstate exactly the hole this closes.)
  const expected = sessionId ? ownerMarker(userId, sessionId) : null

  let owner: string | null = null
  try {
    owner = await SecureStore.getItemAsync(PERSISTENCE_OWNER_KEY)
  } catch {
    // Unreadable marker → treat as unknown owner and wipe to be safe.
  }
  if (expected !== null && owner === expected) return

  if (__DEV__) {
    console.log(
      `[SQLite] Persistence owner (${owner ?? `none`}) != current login (${expected ?? `unknown — no session id`}) — wiping for a clean slate`,
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
    if (expected === null) {
      // Unknown login — leave no marker, so the next launch wipes again rather
      // than trusting a store whose provenance we could not establish.
      await SecureStore.deleteItemAsync(PERSISTENCE_OWNER_KEY)
    } else {
      await SecureStore.setItemAsync(PERSISTENCE_OWNER_KEY, expected)
    }
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
  // Clear the owner marker FIRST, unconditionally (even if _trio is already null
  // or the delete below fails/races). A null marker means "wipe for whoever signs
  // in next": ensureCleanPersistenceForUser then wipes on the NEXT sign-in — same
  // user or different — and retries the delete, so a raced/failed delete here can
  // no longer leave the next session resuming from a stale Electric offset (which
  // manifested as missing build units). App restart WITHOUT sign-out keeps the
  // marker, so session-restore still preserves the offline cache.
  try {
    await SecureStore.deleteItemAsync(PERSISTENCE_OWNER_KEY)
  } catch {
    // best-effort
  }

  if (!_trio) return
  if (__DEV__) console.log(`[SQLite] Disposing persistence…`)
  const trio = _trio
  _trio = null
  try {
    trio.database.closeSync()
    await deleteDatabaseAsync(DATABASE_NAME)
    if (__DEV__) console.log(`[SQLite] Persistence disposed, database file removed`)
  } catch {
    if (__DEV__) console.warn(`[SQLite] Dispose failed (best-effort) — next sign-in will re-wipe`)
  }
}
