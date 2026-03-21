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
    // Update ref synchronously so doUpload can find the resource even when
    // scheduleUpload is called immediately after addPending in the same loop
    // (before React has a chance to reconcile the setState below).
    pendingRef.current = [...pendingRef.current, newItem]
    setPending(pendingRef.current)
    const { objectUrl: _, ...toStore } = newItem
    dbPut(toStore as StoredResource)
    return id
  }, [])

  const scheduleUpload = useCallback(
    (id: string, scheduledAt: Date | null) => {
      // Clear any existing timer for this resource
      const existing = timers.current.get(id)
      if (existing) clearTimeout(existing)

      if (!scheduledAt) {
        // Upload immediately
        doUpload(id)
        return
      }

      const delay = scheduledAt.getTime() - Date.now()
      if (delay <= 0) {
        // Scheduled time already passed — upload now
        doUpload(id)
        return
      }

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
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
    setPendingSync((prev) => {
      const r = prev.find((x) => x.id === id)
      if (r) URL.revokeObjectURL(r.objectUrl)
      return prev.filter((x) => x.id !== id)
    })
    dbDelete(id)
  }, [setPendingSync])

  const retryUpload = useCallback(
    (id: string) => {
      doUpload(id)
    },
    [doUpload]
  )

  // pendingResources: standalone resources (no message/task association) for ResourcesSection
  const pendingResources = filterTaskId
    ? pending.filter((r) => r.taskId === filterTaskId)
    : filterChannelId
    ? pending.filter((r) => r.channelId === filterChannelId && !r.taskId && !r.messageId)
    : pending.filter((r) => !r.channelId && !r.taskId && !r.messageId)

  // messagePending: resources attached to messages in this channel
  const messagePending = filterChannelId
    ? pending.filter((r) => r.channelId === filterChannelId && !!r.messageId)
    : []

  return { pendingResources, messagePending, addPending, scheduleUpload, cancelPending, retryUpload }
}
