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

// Wipes the OPFS file so the next user logging in on the same browser
// does not see the previous user's cached rows on first paint. Best-effort
// — never blocks sign-out.
export async function debugListOPFSFiles(): Promise<void> {
  if (!import.meta.env.DEV) return
  try {
    const root = await navigator.storage?.getDirectory?.()
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

export async function disposePersistence(): Promise<void> {
  if (!_trio) return
  if (import.meta.env.DEV) console.log(`[OPFS] Disposing persistence…`)
  const trio = _trio
  _trio = null
  try {
    const { database, coordinator } = await trio
    coordinator.dispose()
    await database.close?.()
    const root = await navigator.storage?.getDirectory?.()
    await root?.removeEntry(DATABASE_NAME).catch(() => {})
    if (import.meta.env.DEV) console.log(`[OPFS] Persistence disposed, OPFS file removed`)
  } catch {
    if (import.meta.env.DEV) console.warn(`[OPFS] Dispose failed (best-effort)`)
  }
}
