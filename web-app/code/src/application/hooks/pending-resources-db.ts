import type { UploadStatus } from "@buildinlime/sync-core"

const DB_NAME = `buildinlime-pending`
const STORE = `pending`
const VERSION = 1

// PendingResource minus objectUrl — that is a session-only blob URL, recreated on restore
export interface StoredResource {
  id: string
  name: string
  description: string
  file: File
  // Was a hand-written union here that omitted `awaiting_network`, while
  // doUpload persists exactly that value on an offline failure — so the stored
  // shape had a status the type said was impossible. Shared with mobile now.
  status: UploadStatus
  scheduledAt: Date | null
  channelId: string | null
  taskId: string | null
  messageId: string | null
  buildunitId: string
  projectId: string
  createdbyId: string
  errorMessage?: string
}
// Rows written before memberIds was dropped still carry the key in IndexedDB.
// That is harmless — it is read back as an untyped extra property and never
// sent — so no migration is needed.

let dbPromise: Promise<IDBDatabase> | null = null

function getDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE, { keyPath: `id` })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

export async function dbGetAll(): Promise<StoredResource[]> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, `readonly`).objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result as StoredResource[])
    req.onerror = () => reject(req.error)
  })
}

export async function dbPut(item: StoredResource): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, `readwrite`).objectStore(STORE).put(item)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function dbDelete(id: string): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, `readwrite`).objectStore(STORE).delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}
