import {
  BrowserCollectionCoordinator,
  createBrowserWASQLitePersistence,
  openBrowserWASQLiteOPFSDatabase,
} from "@tanstack/browser-db-sqlite-persistence"
import type {
  BrowserWASQLiteDatabase,
  PersistedCollectionPersistence,
} from "@tanstack/browser-db-sqlite-persistence"

const DATABASE_NAME = "buildinlime.sqlite"
const COORDINATOR_DB_NAME = "buildinlime"

// Records which user AND WHICH SESSION the OPFS store currently holds data for,
// as `${userId}:${sessionId}`. See ensureCleanPersistenceForUser — this is the
// web port of mobile's SecureStore marker.
const PERSISTENCE_OWNER_KEY = "buildinlime.persistence_owner"

const ownerMarker = (userId: string, sessionId: string) => `${userId}:${sessionId}`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PersistenceTrio = {
  database: BrowserWASQLiteDatabase
  coordinator: BrowserCollectionCoordinator
  persistence: PersistedCollectionPersistence<any, any>
}

let _trio: Promise<PersistenceTrio> | null = null

export function getPersistence(): Promise<PersistenceTrio> {
  if (_trio) return _trio
  if (import.meta.env.DEV) console.log(`[OPFS] Initializing persistence (db=${DATABASE_NAME})…`)
  const t0 = performance.now()
  _trio = (async () => {
    const database = await openBrowserWASQLiteOPFSDatabase({ databaseName: DATABASE_NAME })
    if (import.meta.env.DEV) console.log(`[OPFS] Database opened in ${(performance.now() - t0).toFixed(0)}ms`)
    const coordinator = new BrowserCollectionCoordinator({ dbName: COORDINATOR_DB_NAME })
    const persistence = createBrowserWASQLitePersistence({
      database,
      coordinator,
    })
    if (import.meta.env.DEV) console.log(`[OPFS] Persistence ready in ${(performance.now() - t0).toFixed(0)}ms`)
    return { database, coordinator, persistence }
  })()
  return _trio
}

/**
 * The OPFS root, or undefined where OPFS is unavailable.
 *
 * The DOM types declare `navigator.storage.getDirectory` non-nullable, and
 * browsers disagree: it is absent in private-browsing modes and older Safari.
 * The optional chaining is therefore deliberate, and the single disable below
 * is why every caller can simply check the result instead of repeating it.
 */
async function opfsRoot(): Promise<FileSystemDirectoryHandle | undefined> {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return await navigator.storage?.getDirectory?.()
}

export async function debugListOPFSFiles(): Promise<void> {
  if (!import.meta.env.DEV) return
  try {
    const root = await opfsRoot()
    if (!root) { console.log(`[OPFS] navigator.storage.getDirectory not available`); return }
    const entries: { name: string; kind: string }[] = []
    for await (const [name, handle] of (root as any).entries()) {
      entries.push({ name, kind: handle.kind })
    }
    if (entries.length === 0) {
      console.log(`[OPFS] No files in OPFS root`)
    } else {
      console.log(`[OPFS] Files in OPFS root:`)
      console.table(entries)
    }
  } catch (e) {
    console.warn(`[OPFS] Could not list files:`, e)
  }
}

/**
 * Close any open handle and remove the store's OPFS files.
 *
 * Removes `buildinlime.sqlite` AND any sibling whose name starts with it: the
 * wa-sqlite VFS can leave journal/WAL companions alongside the main file, and a
 * wipe that leaves those behind is not a wipe. Deliberately scoped to that
 * prefix rather than emptying the OPFS root, which is shared by the whole origin.
 */
async function wipeDatabaseFiles(): Promise<void> {
  if (_trio) {
    const trio = _trio
    _trio = null
    try {
      const { database, coordinator } = await trio
      coordinator.dispose()
      await database.close?.()
    } catch {
      // best-effort — the files are going away regardless
    }
  }

  // No OPFS (private browsing, older Safari) → nothing persisted, nothing to wipe.
  const root = await opfsRoot()
  if (!root) return

  const removed: string[] = []
  try {
    // `entries()` is standard OPFS but missing from the DOM lib types here, same
    // cast debugListOPFSFiles above has to make.
    for await (const [name] of (root as unknown as {
      entries: () => AsyncIterable<[string, unknown]>
    }).entries()) {
      if (typeof name === `string` && name.startsWith(DATABASE_NAME)) {
        await root.removeEntry(name, { recursive: true }).then(
          () => removed.push(name),
          () => {},
        )
      }
    }
  } catch {
    // Directory enumeration unsupported — fall back to the known name.
    await root.removeEntry(DATABASE_NAME, { recursive: true }).then(
      () => removed.push(DATABASE_NAME),
      () => {},
    )
  }
  if (import.meta.env.DEV) {
    console.log(`[OPFS] Removed: ${removed.length > 0 ? removed.join(`, `) : `nothing (no files present)`}`)
  }
}

/**
 * Guarantee the OPFS store belongs to THIS login BEFORE any collection opens it
 * (call at the very start of bootstrap). If the recorded owner differs, wipe first.
 *
 * This is the self-healing counterpart to disposePersistence(), and the whole
 * reason correctness does not rest on that best-effort delete. Sign-out's delete
 * can race in-flight Electric sync writes and its failure is swallowed. When it
 * doesn't fully clear, the next session restores the previous rows AND resumes
 * from the previous Electric sync offsets — and a stale offset makes Electric
 * report "up-to-date" and never re-deliver, so every membership-scoped shape is
 * empty for the whole session. Projects still render through `owner_id = me`, so
 * it presents as "my build units vanished" rather than as a broken app, and
 * nothing self-heals it: no rows arrive, so the resync backstop never fires.
 *
 * Keyed on the SESSION id, not the user id alone: a re-login that never went
 * through sign-out (tab closed, session expired) would otherwise still match and
 * skip the wipe. A genuine reload reuses the same session, matches, and keeps the
 * cache — which is the point of persisting the replica. Ported from mobile's
 * expo-persistence, where this bug was found three times; see ARCHITECTURE.md §7.
 */
export async function ensureCleanPersistenceForUser(
  userId: string,
  sessionId: string,
): Promise<void> {
  // No session id → we cannot tell this login apart from the last one, so treat
  // it as unknown: wipe, and store nothing a later load could match against.
  // (`${userId}:` must NOT be written — it would match next time and reinstate
  // exactly the hole this closes.)
  const expected = sessionId ? ownerMarker(userId, sessionId) : null

  let owner: string | null = null
  try {
    owner = localStorage.getItem(PERSISTENCE_OWNER_KEY)
  } catch {
    // Storage disabled/partitioned → unknown owner, wipe to be safe.
  }
  if (expected !== null && owner === expected) return

  if (import.meta.env.DEV) {
    console.log(
      `[OPFS] Persistence owner (${owner ?? `none`}) != current login (${expected ?? `unknown — no session id`}) — wiping for a clean slate`,
    )
  }

  await wipeDatabaseFiles()

  try {
    if (expected === null) {
      localStorage.removeItem(PERSISTENCE_OWNER_KEY)
    } else {
      localStorage.setItem(PERSISTENCE_OWNER_KEY, expected)
    }
  } catch {
    // Worst case is a redundant wipe on the next load.
    if (import.meta.env.DEV) console.warn(`[OPFS] Failed to record persistence owner`)
  }
}

export async function disposePersistence(): Promise<void> {
  // Clear the owner marker FIRST, unconditionally (even if _trio is already null
  // or the wipe below fails). A missing marker means "wipe for whoever loads
  // next", so ensureCleanPersistenceForUser re-attempts the delete rather than
  // letting the next session resume from a stale Electric offset.
  try {
    localStorage.removeItem(PERSISTENCE_OWNER_KEY)
  } catch {
    // best-effort
  }

  if (import.meta.env.DEV) console.log(`[OPFS] Disposing persistence…`)
  try {
    await wipeDatabaseFiles()
    if (import.meta.env.DEV) console.log(`[OPFS] Persistence disposed`)
  } catch {
    if (import.meta.env.DEV) console.warn(`[OPFS] Dispose failed (best-effort) — next sign-in will re-wipe`)
  }
}
