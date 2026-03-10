---
name: Large File Upload (Alternative B — Direct Server Upload)
description: This skill should be used when adding file attachment/upload functionality to a BuildInLime entity (channel, task, build unit). Files go directly to the server filesystem. Electric-synced metadata table holds what other clients see. A server-only raw table holds the storage path. Other clients see nothing until upload completes. Uploading client sees the file immediately via objectUrl. Includes scheduled uploads (date + hourly time slot picker).
version: 1.0.0
---

# Large File Upload in BuildInLime (Alternative B)

## Architecture Overview

```
Uploading client:
  File picked → addPending() → local state (objectUrl) → scheduleUpload() → doUpload()
                                                                              ↓
                                                               POST /api/resources/upload
                                                                              ↓
                                                               writes file to ./uploads/resources/{id}/
                                                                              ↓
                                                               DB: INSERT resourcesTable (Electric-synced)
                                                                   INSERT resourcesRawTable (server-only)
                                                                              ↓
                                                               Electric propagates row → resourcesCollection

Other clients:
  resourcesCollection syncs → see resource row → download via /api/resources/{id}/file
```

**Key invariant:** `resourcesTable` is Electric-synced (metadata). `resourcesRawTable` is server-only (storage path). Upload route inserts both directly — no `onInsert` hook needed. Electric propagates the `resourcesTable` row to other clients automatically.

---

## Files to Create / Modify

| Step | File | Action |
|---|---|---|
| 1 | `src/infrastructure/database/schema/admin-schema.ts` | Add `resourcesTable` + `resourcesRawTable` + Zod schemas |
| 2 | `src/infrastructure/trpc/resources.ts` | tRPC router (delete only) |
| 3 | `src/presentation/routes/api/trpc/$.ts` | Register `resourcesRouter` |
| 4 | `src/presentation/routes/api/resources.ts` | Electric shape proxy |
| 5 | `src/presentation/routes/api/resources/upload.ts` | Multipart POST — write file + insert DB rows |
| 6 | `src/presentation/routes/api/resources/$resourceId/file.ts` | GET — stream file from disk |
| 7 | `src/infrastructure/database/tanstack-db-electric/admincollections.ts` | `resourcesCollection` |
| 8a | `src/presentation/hooks/pending-resources-db.ts` | IndexedDB helper (persist pending across refreshes) |
| 8b | `src/presentation/hooks/use-pending-resources.ts` | Pending state + upload logic + IndexedDB hydration |
| 9 | `src/presentation/components/buildInlime/add-resource-form.tsx` | Inline add form |
| 10 | `src/presentation/components/buildInlime/upload-schedule-popover.tsx` | Schedule popover (calendar + time) |
| 11 | `src/presentation/components/buildInlime/ResourcesSection.tsx` | Section component |
| 12 | Route loader | `resourcesCollection.preload()` |
| 13 | Page component | Wire `<ResourcesSection>` props |

---

## Step-by-Step

### 1. Schema — `admin-schema.ts`

```ts
import { bigint } from "drizzle-orm/pg-core"

export const resourcesTable = pgTable(`resources`, {
  id: text(`id`).primaryKey(),
  name: varchar(`name`, { length: 255 }).notNull(),
  description: text(`description`),
  file_location: text(`file_location`).notNull(),   // e.g. /api/resources/{id}/file
  mime_type: varchar(`mime_type`, { length: 100 }).notNull(),
  file_size_bytes: bigint(`file_size_bytes`, { mode: 'number' }).notNull(),
  uploaded_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  message_id: text(`message_id`).references(() => messagesTable.id, { onDelete: `cascade` }),
  channel_id: text(`channel_id`).references(() => channelsTable.id, { onDelete: `cascade` }),
  buildunit_id: text(`buildunit_id`).notNull().references(() => buildUnitsTable.id, { onDelete: `cascade` }),
  project_id: text(`project_id`).notNull().references(() => projectsTable.id, { onDelete: `cascade` }),
  createdby_id: text(`createdby_id`).notNull().references(() => users.id, { onDelete: `cascade` }),
  member_ids: text('member_ids').array().notNull(),
})

// Server-only — not synced via Electric.
export const resourcesRawTable = pgTable(`resources_raw`, {
  id: text(`id`).primaryKey(),
  resource_id: text(`resource_id`).notNull().references(() => resourcesTable.id, { onDelete: `cascade` }),
  storage_path: text(`storage_path`).notNull(),
  original_filename: text(`original_filename`).notNull(),
  mime_type: varchar(`mime_type`, { length: 100 }).notNull(),
  file_size_bytes: bigint(`file_size_bytes`, { mode: 'number' }).notNull(),
  uploaded_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const selectResourceSchema = createSelectSchema(resourcesTable).extend({
  description: z.string().nullish(),
  message_id: z.string().nullish(),
  channel_id: z.string().nullish(),
  file_size_bytes: z.number(),
})
export const createResourceSchema = createInsertSchema(resourcesTable).omit({ uploaded_at: true })
export const updateResourceSchema = createUpdateSchema(resourcesTable)
```

---

### 2. tRPC Router — `src/infrastructure/trpc/resources.ts`

Only a `delete` procedure is needed — upload happens via a raw API route (not tRPC) because multipart form data doesn't work through tRPC.

```ts
import { router, authedProcedure, generateTxId } from "./lib/trpc"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { eq } from "drizzle-orm"
import { promises as fs } from "node:fs"
import { resourcesTable, resourcesRawTable } from "../database/schema/admin-schema"

export const resourcesRouter = router({
  delete: authedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const rawRecords = await ctx.db
        .select()
        .from(resourcesRawTable)
        .where(eq(resourcesRawTable.resource_id, input.id))

      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        const [deletedItem] = await tx
          .delete(resourcesTable)
          .where(eq(resourcesTable.id, input.id))
          .returning()
        if (!deletedItem) throw new TRPCError({ code: `NOT_FOUND`, message: `Resource not found` })
        return { item: deletedItem, txid }
      })

      for (const raw of rawRecords) {
        try {
          await fs.unlink(raw.storage_path)
          const dir = raw.storage_path.substring(0, raw.storage_path.lastIndexOf("/"))
          await fs.rmdir(dir).catch(() => {})
        } catch {
          // File may already be gone — not fatal
        }
      }

      return result
    }),
})
```

---

### 3. Register in App Router — `src/presentation/routes/api/trpc/$.ts`

```ts
import { resourcesRouter } from "%/infrastructure/trpc/resources"

export const appRouter = router({
  // ...existing routers...
  resources: resourcesRouter,
})
```

---

### 4. Electric Shape API Route — `src/presentation/routes/api/resources.ts`

```ts
import { createFileRoute } from "@tanstack/react-router"
import { auth } from "../../../infrastructure/auth/server"
import { prepareElectricUrl, proxyElectricRequest } from "../../../infrastructure/database/electric-proxy"

const serve = async ({ request }: { request: Request }) => {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }
  const originUrl = prepareElectricUrl(request.url)
  originUrl.searchParams.set("table", "resources")
  originUrl.searchParams.set("where", `'${session.user.id}' = ANY(member_ids)`)
  return proxyElectricRequest(originUrl)
}

export const Route = createFileRoute("/api/resources")({
  server: { handlers: { GET: serve } },
})
```

---

### 5. Upload API Route — `src/presentation/routes/api/resources/upload.ts`

```ts
import { createFileRoute } from "@tanstack/react-router"
import { promises as fs } from "node:fs"
import path from "node:path"
import { auth } from "../../../../infrastructure/auth/server"
import { db } from "../../../../infrastructure/database/connection"
import { resourcesTable, resourcesRawTable } from "../../../../infrastructure/database/schema/admin-schema"

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads", "resources")

const handleUpload = async ({ request }: { request: Request }) => {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid multipart form data" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    })
  }

  const file = formData.get("file") as File | null
  const resourceId = formData.get("resourceId") as string | null
  const name = formData.get("name") as string | null
  const description = (formData.get("description") as string | null) ?? undefined
  const channelId = (formData.get("channelId") as string | null) ?? undefined
  const buildunitId = formData.get("buildunitId") as string | null
  const projectId = formData.get("projectId") as string | null
  const memberIdsRaw = formData.get("memberIds") as string | null

  if (!file || !resourceId || !name || !buildunitId || !projectId) {
    return new Response(
      JSON.stringify({ error: "Missing required fields" }),
      { status: 400, headers: { "content-type": "application/json" } }
    )
  }

  const memberIds: string[] = memberIdsRaw ? JSON.parse(memberIdsRaw) : [session.user.id]
  const mimeType = file.type || "application/octet-stream"
  const originalFilename = file.name
  const fileSizeBytes = Number(file.size)  // explicit Number() conversion

  const safeFilename = path.basename(originalFilename).replace(/[^a-zA-Z0-9._-]/g, "_")
  const resourceDir = path.join(UPLOADS_DIR, resourceId)
  const storagePath = path.join(resourceDir, safeFilename)
  const fileLocation = `/api/resources/${resourceId}/file`

  try {
    await fs.mkdir(resourceDir, { recursive: true })
    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(storagePath, buffer)
  } catch (err) {
    console.error("File write error:", err)
    return new Response(JSON.stringify({ error: "Failed to save file" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }

  try {
    const rawId = crypto.randomUUID()
    await db.transaction(async (tx) => {
      await tx.insert(resourcesTable).values({
        id: resourceId,
        name,
        description,
        file_location: fileLocation,
        mime_type: mimeType,
        file_size_bytes: fileSizeBytes,
        channel_id: channelId ?? null,
        buildunit_id: buildunitId,
        project_id: projectId,
        createdby_id: session.user.id,
        member_ids: memberIds,
      })
      await tx.insert(resourcesRawTable).values({
        id: rawId,
        resource_id: resourceId,
        storage_path: storagePath,
        original_filename: originalFilename,
        mime_type: mimeType,
        file_size_bytes: fileSizeBytes,
      })
    })

    return new Response(JSON.stringify({ ok: true }), {
      status: 201,
      headers: { "content-type": "application/json" },
    })
  } catch (err) {
    await fs.unlink(storagePath).catch(() => {})
    await fs.rmdir(resourceDir).catch(() => {})
    console.error("DB insert error:", err)
    return new Response(JSON.stringify({ error: "Failed to save resource record" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }
}

export const Route = createFileRoute("/api/resources/upload")({
  server: { handlers: { POST: handleUpload } },
})
```

> **Important:** Return `{ ok: true }` (not the full DB row). Returning the inserted row risks a `TypeError: can't convert BigInt to number` in `JSON.stringify` because Drizzle's `bigint` with `mode: 'number'` may return a BigInt from `.returning()` in some Node.js versions. The client doesn't need the row anyway — Electric propagates it.

---

### 6. File Download Route — `src/presentation/routes/api/resources/$resourceId/file.ts`

```ts
import { createFileRoute } from "@tanstack/react-router"
import { promises as fs } from "node:fs"
import { auth } from "../../../../../infrastructure/auth/server"
import { db } from "../../../../../infrastructure/database/connection"
import { resourcesTable, resourcesRawTable } from "../../../../../infrastructure/database/schema/admin-schema"
import { eq, and, sql } from "drizzle-orm"

const serveFile = async ({ request, params }: { request: Request; params: Record<string, string> }) => {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  const { resourceId } = params

  const resources = await db
    .select()
    .from(resourcesTable)
    .where(
      and(
        eq(resourcesTable.id, resourceId),
        sql`'${sql.raw(session.user.id)}' = ANY(${resourcesTable.member_ids})`
      )
    )

  if (resources.length === 0) {
    return new Response(JSON.stringify({ error: "Resource not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    })
  }

  const rawRecords = await db
    .select()
    .from(resourcesRawTable)
    .where(eq(resourcesRawTable.resource_id, resourceId))

  if (rawRecords.length === 0) {
    return new Response(JSON.stringify({ error: "File record not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    })
  }

  const raw = rawRecords[0]

  try {
    const fileBuffer = await fs.readFile(raw.storage_path)
    const disposition = `attachment; filename="${encodeURIComponent(raw.original_filename)}"`
    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "content-type": raw.mime_type,
        "content-length": String(raw.file_size_bytes),
        "content-disposition": disposition,
        "cache-control": "private, max-age=3600",
      },
    })
  } catch {
    return new Response(JSON.stringify({ error: "File not found on server" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    })
  }
}

export const Route = createFileRoute("/api/resources/$resourceId/file")({
  server: { handlers: { GET: serveFile } },
})
```

---

### 7. Electric Collection — `admincollections.ts`

```ts
import { selectResourceSchema } from "../schema/admin-schema"

export const resourcesCollection = createCollection(
  electricCollectionOptions({
    id: `resources`,
    shapeOptions: {
      url: new URL(
        `/api/resources`,
        typeof window !== `undefined` ? window.location.origin : `https://localhost:5173`
      ).toString(),
      parser: { timestamptz: (date: string) => new Date(date) },
    },
    schema: selectResourceSchema.extend({
      // Electric returns bigint columns as strings — coerce to number
      file_size_bytes: z.preprocess(
        (v) => (typeof v === "string" ? Number(v) : v),
        z.number()
      ),
    }),
    getKey: (item) => item.id,
    onDelete: async ({ transaction }) => {
      const { original: deletedResource } = transaction.mutations[0]
      const result = await trpc.resources.delete.mutate({ id: deletedResource.id })
      return { txid: result.txid }
    },
    // No onInsert — upload route inserts directly into DB; Electric syncs the row
  })
)
```

---

### 8a. IndexedDB Helper — `src/presentation/hooks/pending-resources-db.ts`

Persists pending resources across page refreshes. Stores the raw `File` object (IndexedDB supports Blobs/Files natively). The `objectUrl` is intentionally excluded — it's a session-only blob URL that must be recreated from `File` on restore.

```ts
const DB_NAME = `buildinlime-pending`
const STORE = `pending`
const VERSION = 1

// PendingResource minus objectUrl — that is a session-only blob URL, recreated on restore
export interface StoredResource {
  id: string
  name: string
  description: string
  file: File
  status: `awaiting_schedule` | `scheduled` | `uploading` | `error`
  scheduledAt: Date | null
  channelId: string | null
  taskId: string | null
  messageId: string | null
  buildunitId: string
  projectId: string
  createdbyId: string
  memberIds: string[]
  errorMessage?: string
}

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
```

---

### 8b. Pending Resources Hook — `src/presentation/hooks/use-pending-resources.ts`

Imports the IndexedDB helpers. On mount, hydrates state from IndexedDB and restores timers for scheduled items.

```ts
import { useState, useRef, useCallback, useEffect } from "react"
import { dbGetAll, dbPut, dbDelete, type StoredResource } from "./pending-resources-db"

export type UploadStatus = "awaiting_schedule" | "scheduled" | "uploading" | "error"

export interface PendingResource {
  id: string
  name: string
  description: string
  file: File
  objectUrl: string
  status: UploadStatus
  scheduledAt: Date | null
  channelId: string | null
  taskId?: string | null
  messageId?: string | null
  buildunitId: string
  projectId: string
  createdbyId: string
  memberIds: string[]
  errorMessage?: string
}

export interface AddPendingOptions {
  name: string
  description: string
  channelId: string | null
  taskId?: string | null
  messageId?: string | null
  buildunitId: string
  projectId: string
  createdbyId: string
  memberIds: string[]
}

export function usePendingResources(filterChannelId: string | null, filterTaskId?: string | null) {
  const [pending, setPending] = useState<PendingResource[]>([])
  const pendingRef = useRef<PendingResource[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  // Stable ref so the hydration effect can call doUpload before it is defined
  const doUploadRef = useRef<(id: string) => Promise<void>>(async () => {})

  const setPendingSync = useCallback((updater: (prev: PendingResource[]) => PendingResource[]) => {
    setPending((prev) => {
      const next = updater(prev)
      pendingRef.current = next
      return next
    })
  }, [])

  // Revoke all object URLs on unmount
  useEffect(() => {
    return () => {
      pendingRef.current.forEach((r) => URL.revokeObjectURL(r.objectUrl))
      timers.current.forEach((t) => clearTimeout(t))
    }
  }, [])

  // Hydrate from IndexedDB on mount
  useEffect(() => {
    dbGetAll().then((stored) => {
      if (stored.length === 0) return
      const hydrated: PendingResource[] = stored.map((s) => {
        // Reset uploading → awaiting_schedule (upload was interrupted by refresh)
        const status: UploadStatus = s.status === "uploading" ? "awaiting_schedule" : s.status
        return { ...s, status, objectUrl: URL.createObjectURL(s.file) }
      })
      pendingRef.current = hydrated
      setPending(hydrated)

      hydrated.forEach((r, i) => {
        // Persist the status reset back to IndexedDB
        if (r.status === "awaiting_schedule" && stored[i].status === "uploading") {
          const { objectUrl: _, ...toStore } = r
          dbPut(toStore as StoredResource)
        }
        // Re-schedule timers for items that were waiting for a future time
        if (r.status === "scheduled" && r.scheduledAt) {
          const delay = r.scheduledAt.getTime() - Date.now()
          if (delay <= 0) {
            doUploadRef.current(r.id)
          } else {
            const timer = setTimeout(() => {
              timers.current.delete(r.id)
              doUploadRef.current(r.id)
            }, delay)
            timers.current.set(r.id, timer)
          }
        }
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const doUpload = useCallback(async (id: string) => {
    const resource = pendingRef.current.find((r) => r.id === id)
    if (!resource) return

    setPendingSync((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "uploading" as UploadStatus } : r))
    )
    const { objectUrl: _, ...toStore } = resource
    dbPut({ ...toStore, status: "uploading" } as StoredResource)

    const formData = new FormData()
    formData.append("file", resource.file)
    formData.append("resourceId", resource.id)
    formData.append("name", resource.name)
    if (resource.description) formData.append("description", resource.description)
    if (resource.channelId) formData.append("channelId", resource.channelId)
    if (resource.taskId) formData.append("taskId", resource.taskId)
    if (resource.messageId) formData.append("messageId", resource.messageId)
    formData.append("buildunitId", resource.buildunitId)
    formData.append("projectId", resource.projectId)
    formData.append("memberIds", JSON.stringify(resource.memberIds))

    try {
      const res = await fetch("/api/resources/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }))
        throw new Error(err.error ?? "Upload failed")
      }
      // Upload succeeded — remove from pending (Electric will add it to the collection)
      setPendingSync((prev) => {
        const r = prev.find((x) => x.id === id)
        if (r) URL.revokeObjectURL(r.objectUrl)
        return prev.filter((x) => x.id !== id)
      })
      dbDelete(id)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed"
      setPendingSync((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, status: "error" as UploadStatus, errorMessage: message } : r
        )
      )
      dbPut({ ...toStore, status: "error", errorMessage: message } as StoredResource)
    }
  }, [setPendingSync])

  // Keep ref in sync with latest doUpload
  useEffect(() => {
    doUploadRef.current = doUpload
  }, [doUpload])

  const addPending = useCallback((file: File, opts: AddPendingOptions) => {
    const id = crypto.randomUUID()
    const objectUrl = URL.createObjectURL(file)
    const newItem: PendingResource = {
      id,
      name: opts.name,
      description: opts.description,
      file,
      objectUrl,
      status: "awaiting_schedule",
      scheduledAt: null,
      channelId: opts.channelId,
      taskId: opts.taskId ?? null,
      messageId: opts.messageId ?? null,
      buildunitId: opts.buildunitId,
      projectId: opts.projectId,
      createdbyId: opts.createdbyId,
      memberIds: opts.memberIds,
    }
    pendingRef.current = [...pendingRef.current, newItem]
    setPending(pendingRef.current)
    const { objectUrl: _, ...toStore } = newItem
    dbPut(toStore as StoredResource)
    return id
  }, [])

  const scheduleUpload = useCallback(
    (id: string, scheduledAt: Date | null) => {
      const existing = timers.current.get(id)
      if (existing) clearTimeout(existing)

      if (!scheduledAt) { doUpload(id); return }

      const delay = scheduledAt.getTime() - Date.now()
      if (delay <= 0) { doUpload(id); return }

      setPendingSync((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, status: "scheduled" as UploadStatus, scheduledAt } : r
        )
      )
      const resource = pendingRef.current.find((r) => r.id === id)
      if (resource) {
        const { objectUrl: _, ...toStore } = resource
        dbPut({ ...toStore, status: "scheduled", scheduledAt } as StoredResource)
      }

      const timer = setTimeout(() => {
        timers.current.delete(id)
        doUpload(id)
      }, delay)
      timers.current.set(id, timer)
    },
    [doUpload, setPendingSync]
  )

  const cancelPending = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer) { clearTimeout(timer); timers.current.delete(id) }
    setPendingSync((prev) => {
      const r = prev.find((x) => x.id === id)
      if (r) URL.revokeObjectURL(r.objectUrl)
      return prev.filter((x) => x.id !== id)
    })
    dbDelete(id)
  }, [setPendingSync])

  const retryUpload = useCallback((id: string) => { doUpload(id) }, [doUpload])

  const pendingResources = filterTaskId
    ? pending.filter((r) => r.taskId === filterTaskId)
    : filterChannelId
    ? pending.filter((r) => r.channelId === filterChannelId && !r.taskId && !r.messageId)
    : pending.filter((r) => !r.channelId && !r.taskId && !r.messageId)

  const messagePending = filterChannelId
    ? pending.filter((r) => r.channelId === filterChannelId && !!r.messageId)
    : []

  return { pendingResources, messagePending, addPending, scheduleUpload, cancelPending, retryUpload }
}
```

---

### 9. Add Resource Form — `src/presentation/components/buildInlime/add-resource-form.tsx`

Inline form with name, description, and file picker:

```tsx
import { useState, useRef } from "react"
import { Paperclip, X } from "lucide-react"

interface AddResourceFormProps {
  onSubmit: (file: File, meta: { name: string; description: string }) => void
  onCancel: () => void
}

export function AddResourceForm({ onSubmit, onCancel }: AddResourceFormProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    if (!name) setName(f.name.replace(/\.[^.]+$/, ""))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !name.trim()) return
    onSubmit(file, { name: name.trim(), description: description.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="mb-3 p-3 bg-[#fdf8f2] border border-[#e5d4c1] rounded space-y-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Resource name"
        required
        className="w-full text-sm px-2 py-1.5 border border-[#e5d4c1] rounded focus:outline-none focus:ring-1 focus:ring-[#976623]"
      />
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="w-full text-sm px-2 py-1.5 border border-[#e5d4c1] rounded focus:outline-none focus:ring-1 focus:ring-[#976623]"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 text-xs px-2 py-1.5 border border-[#e5d4c1] rounded text-[#717182] hover:bg-[#f0e5d8] transition-colors"
        >
          <Paperclip className="w-3 h-3" />
          {file ? file.name : "Attach file"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="flex-1" />
        <button type="button" onClick={onCancel} className="text-xs text-[#717182] hover:text-[#1e1e1e]">
          Cancel
        </button>
        <button
          type="submit"
          disabled={!file || !name.trim()}
          className="text-xs px-3 py-1.5 bg-[#976623] text-white rounded hover:bg-[#7d5419] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Add
        </button>
      </div>
    </form>
  )
}
```

---

### 10. Upload Schedule Popover — `src/presentation/components/buildInlime/upload-schedule-popover.tsx`

Uses `@radix-ui/react-popover` and `date-fns`. Shows "Upload Now" + mini calendar + hourly time slots.

Key pieces:
- Trigger icon changes per status: `Upload` (awaiting), `Clock` (scheduled), `Loader2 animate-spin` (uploading), `AlertTriangle` (error)
- Calendar: `startOfMonth`, `endOfMonth`, `eachDayOfInterval`, `getDay` for padding, `isBefore`/`isSameDay` for state
- Time slots: 24 hourly buttons in a `grid grid-cols-3` with `max-h-28 overflow-y-auto`
- Warning: "Closing this tab will cancel scheduled uploads"

See existing implementation at `src/presentation/components/buildInlime/upload-schedule-popover.tsx`.

---

### 11. ResourcesSection Component — `src/presentation/components/buildInlime/ResourcesSection.tsx`

```tsx
export interface ResourcesSectionProps {
  channelId: string | null   // null = build-unit-level resource (no channel)
  buildunitId: string
  projectId: string
  createdbyId: string
  memberIds: string[]
}

export function ResourcesSection({ channelId, buildunitId, projectId, createdbyId, memberIds }) {
  const [formOpen, setFormOpen] = useState(false)
  const { pendingResources, addPending, scheduleUpload, cancelPending, retryUpload } =
    usePendingResources(channelId)

  const { data: syncedResources } = useLiveQuery(
    (q) => q.from({ resourcesCollection }).where(({ resourcesCollection: r }) =>
      eq(r.channel_id, channelId ?? "")
    ),
    [channelId]
  )

  const handleFormSubmit = (file: File, meta: { name: string; description: string }) => {
    addPending(file, { name: meta.name, description: meta.description, channelId, buildunitId, projectId, createdbyId, memberIds })
    setFormOpen(false)
  }

  // Render:
  // 1. Header with "+" button to toggle AddResourceForm
  // 2. AddResourceForm (when formOpen)
  // 3. pendingResources — each shows: mime icon, name, status text, local download link (objectUrl),
  //    UploadSchedulePopover, cancel button (X)
  // 4. syncedResources — each shows: mime icon, name, size+description, server download link (file_location),
  //    delete button (calls resourcesCollection.delete(r.id))
}
```

---

### 12. Preload in Route Loader

```ts
import { resourcesCollection } from "%/infrastructure/database/tanstack-db-electric/admincollections"

loader: async () => {
  await Promise.all([
    // ...existing preloads...
    resourcesCollection.preload(),
  ])
},
```

---

### 13. Wire Props in Page Component

```tsx
import { useSession } from "%/infrastructure/auth/client"

const { data: session } = useSession()

<ResourcesSection
  channelId={channelId}        // string | null
  buildunitId={buildUnitId}
  projectId={projectId}
  createdbyId={session?.user.id ?? ""}
  memberIds={session?.user.id ? [session.user.id] : []}
/>
```

---

## DB Migration

```bash
pnpm migrate:generate   # creates SQL in drizzle/
pnpm migrate            # applies to DB
```

If `migrate:generate` prompts interactively (TTY required), run it in a real terminal, not piped.

If the generated migration contains erroneous statements from previously applied migrations (e.g. `ALTER TABLE tasks ADD COLUMN name` when `name` already exists), **manually edit the migration SQL file** to remove conflicting statements before running `pnpm migrate`.

---

## Troubleshooting

### Upload shows "uploading" status but no network call is made

**Cause:** `doUpload` reads state using the "ref trick" (calling `setPending` with a side-effect to capture `prev`). React batches state updates — the updater function hasn't run by the time `if (!resource) return` executes, so `resource` is always `undefined`.

**Fix:** Use `pendingRef` — a ref that mirrors state, updated inside `setPendingSync`'s updater (which React calls synchronously when flushing):

```ts
const pendingRef = useRef<PendingResource[]>([])

const setPendingSync = useCallback((updater) => {
  setPending((prev) => {
    const next = updater(prev)
    pendingRef.current = next   // ← synced synchronously during flush
    return next
  })
}, [])

// In doUpload:
const resource = pendingRef.current.find((r) => r.id === id)   // ← always works
```

**Rule:** Never call `setPending` directly anywhere in this hook. Always use `setPendingSync`.

---

### `TypeError: can't convert BigInt to number` during upload

**Cause:** The upload route returns the full inserted DB row via `.returning()`. Drizzle's `bigint` column with `mode: 'number'` may return a JS `BigInt` from `.returning()` in some Node.js / drizzle-orm version combinations. `JSON.stringify` then fails serializing the BigInt.

**Fix:** Don't return the DB row in the upload response. Return only `{ ok: true }`:

```ts
return new Response(JSON.stringify({ ok: true }), {
  status: 201,
  headers: { "content-type": "application/json" },
})
```

The client doesn't use the response body — Electric propagates the new row automatically.

Also use explicit `Number()` conversion when reading `file.size`:
```ts
const fileSizeBytes = Number(file.size)
```

---

### Pending resources disappear on page refresh

**Cause:** Pending resources were stored only in React state (`useState`). On refresh, state is reset and all pending items (including their `File` objects) are lost.

**Fix:** Use `pending-resources-db.ts` (IndexedDB) to persist the full `StoredResource` (including the raw `File` object, which IndexedDB supports natively). On mount, `usePendingResources` calls `dbGetAll()` to hydrate state and restores timers.

**Key rules:**
- `objectUrl` is **never stored** in IndexedDB — it's a session-only blob URL. Recreate it with `URL.createObjectURL(storedItem.file)` on hydration.
- Items with `status === "uploading"` at restore time are reset to `"awaiting_schedule"` — the upload was interrupted and must be retried manually.
- Items with `status === "scheduled"` have their timers re-evaluated: if `scheduledAt` is in the past, upload immediately; otherwise, set a new `setTimeout`.
- Use `doUploadRef` (a stable `useRef`) in the hydration `useEffect` to call `doUpload` without adding it as a dependency (which would cause the effect to re-run on every render). Keep `doUploadRef.current` in sync via a separate `useEffect([doUpload])`.

**IndexedDB operations per action:**
- `addPending` → `dbPut`
- `scheduleUpload` → `dbPut` (updated status + scheduledAt)
- `doUpload` start → `dbPut` (status: uploading)
- `doUpload` success → `dbDelete`
- `doUpload` error → `dbPut` (status: error + errorMessage)
- `cancelPending` → `dbDelete`

---

### `TypeError: can't convert BigInt to number` on page load (Channel page / ResourcesSection)

**Symptom:** The Channel page crashes on load with `TypeError: can't convert BigInt to number` (Firefox) or `Cannot mix BigInt and other types` (Chrome). The error points to `ResourcesSection.tsx` even when no upload has been attempted.

**Cause:** Two separate issues combine:

1. **Electric or TanStack DB can deliver `file_size_bytes` as a native JavaScript `BigInt`** (not a string, not a number) when syncing existing rows from PostgreSQL. The `z.preprocess` in the collection schema only checked `typeof v === "string"`, so BigInt values passed through unconverted.

2. **`formatBytes` does arithmetic with the raw value** (`bytes / 1024`). Mixing a BigInt with a Number in division throws: `"can't convert BigInt to number"`.

**Fix — two parts:**

1. Update the preprocess in `admincollections.ts` to handle both string and BigInt inputs:

```ts
schema: selectResourceSchema.extend({
  file_size_bytes: z.preprocess(
    (v) => (typeof v === "string" || typeof v === "bigint" ? Number(v) : v),
    z.number()
  ),
}),
```

2. Make `formatBytes` in `ResourcesSection.tsx` defensive against BigInt by converting to `Number` first:

```ts
function formatBytes(bytes: number | bigint) {
  const n = Number(bytes)
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
```

**Rule:** Any helper that does arithmetic on `file_size_bytes` must call `Number()` on it first. The `z.preprocess` is the right place to normalise at the collection boundary, but `formatBytes` should be defensive as a second layer.

---

### Synced resource `file_size_bytes` is a string, breaking `formatBytes`

**Cause:** Electric returns PostgreSQL `bigint` columns as JSON strings (e.g. `"12345"`) in text mode. Without coercion, `z.number()` rejects the string and the row fails schema validation.

**Fix:** Use `z.preprocess` in the Electric collection schema to coerce both strings and BigInts:

```ts
schema: selectResourceSchema.extend({
  file_size_bytes: z.preprocess(
    (v) => (typeof v === "string" || typeof v === "bigint" ? Number(v) : v),
    z.number()
  ),
}),
```

---

## Key Patterns

- **No `onInsert` on `resourcesCollection`** — the upload route inserts into DB directly; Electric picks up the DB change automatically. `onInsert` is only for optimistic client-side collection inserts.
- **`pendingRef` pattern** — the single most important pattern in this skill. Every `usePendingResources` write goes through `setPendingSync`, which keeps `pendingRef.current` in sync. Async callbacks always read from `pendingRef.current`, never from closed-over state.
- **`channelId: null`** — resources at build-unit level (not attached to a channel) use `channelId: null`. `usePendingResources(null)` filters by `!r.channelId`. The Electric `where` filter falls back to `eq(r.channel_id, "")` (returns nothing for null channelId, which is correct — the build-unit page would query differently).
- **`objectUrl`** — a `URL.createObjectURL(file)` allows the uploading client to download the file locally before upload completes. Always revoke via `URL.revokeObjectURL` when the pending resource is removed. Never store `objectUrl` in IndexedDB — it's session-only.
- **IndexedDB persistence** — `pending-resources-db.ts` stores the full `StoredResource` (including the raw `File` object) so pending items survive page refreshes. Hydration runs on mount in a `useEffect`. `objectUrl` is recreated from `File` on restore.
- **`doUploadRef` pattern** — the hydration `useEffect` runs before `doUpload` is defined, so it uses a stable `useRef` (`doUploadRef`) to call it. A separate `useEffect([doUpload])` keeps the ref current. This avoids adding `doUpload` as a dependency of the hydration effect.
- **Uploads directory** — files go to `./uploads/resources/{resourceId}/{safeFilename}` relative to `process.cwd()`. Add `uploads/` to `.gitignore`.
