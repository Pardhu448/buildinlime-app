import { useState, useRef, useCallback, useEffect } from "react"
import {
  nextRetryDelay,
  shouldAutoRetry,
  statusForFailure,
  isRetryableStatus,
  scheduleDecision,
} from "@buildinlime/sync-core"
import type { UploadStatus } from "@buildinlime/sync-core"
import { dbGetAll, dbPut, dbDelete  } from "./pending-resources-db"
import type {StoredResource} from "./pending-resources-db";

// Retry/backoff numbers and the status vocabulary are shared with mobile — see
// @buildinlime/sync-core's upload-policy. Re-exported because the schedule
// popover imports the type from here.
export type { UploadStatus }

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
}

export function usePendingResources(filterChannelId: string | null, filterTaskId?: string | null) {
  const [pending, setPending] = useState<PendingResource[]>([])
  const pendingRef = useRef<PendingResource[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const retryTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const retryAttempts = useRef<Map<string, number>>(new Map())
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
      retryTimers.current.forEach((t) => clearTimeout(t))
    }
  }, [])

  // Auto-retry any errored uploads as soon as the browser reports we're back online.
  useEffect(() => {
    const onOnline = () => {
      pendingRef.current.forEach((r) => {
        if (isRetryableStatus(r.status)) {
          retryAttempts.current.set(r.id, 0)
          const t = retryTimers.current.get(r.id)
          if (t) {
            clearTimeout(t)
            retryTimers.current.delete(r.id)
          }
          doUploadRef.current(r.id)
        }
      })
    }
    window.addEventListener("online", onOnline)
    return () => window.removeEventListener("online", onOnline)
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
        // Errored / waiting-for-network uploads from a previous session: retry
        // once on mount if we think we're online; otherwise the `online`
        // listener will pick them up when connectivity returns.
        if (isRetryableStatus(r.status) && navigator.onLine) {
          doUploadRef.current(r.id)
        }
        // Re-schedule timers for items that were waiting for a future time
        if (r.status === "scheduled" && r.scheduledAt) {
          const decision = scheduleDecision(r.scheduledAt)
          if (decision.kind === "now") {
            doUploadRef.current(r.id)
          } else {
            const timer = setTimeout(() => {
              timers.current.delete(r.id)
              doUploadRef.current(r.id)
            }, decision.delayMs)
            timers.current.set(r.id, timer)
          }
        }
      })
    })
  // Mount-only on purpose: this hydrates the pending queue once.
  }, [])

  const doUpload = useCallback(async (id: string) => {
    const resource = pendingRef.current.find((r) => r.id === id)
    if (!resource) return
    // Skip if an upload is already in flight for this resource (online-event
    // retries, multiple mounted hook instances, etc. can all race).
    if (resource.status === "uploading") return

    const existingRetry = retryTimers.current.get(id)
    if (existingRetry) {
      clearTimeout(existingRetry)
      retryTimers.current.delete(id)
    }

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
    // No memberIds: the upload handler never read it, and resources no longer
    // carry a member_ids column at all — access is resolved through the
    // channel's memberships instead (see fileStorage.ts serveResourceFile).

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
      retryAttempts.current.delete(id)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed"
      // While offline this isn't really a failure — surface it as a calmer
      // "waiting for network" state so the user doesn't see a red error for
      // an upload we're going to retry as soon as connectivity returns.
      const nextStatus = statusForFailure(navigator.onLine)
      setPendingSync((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, status: nextStatus, errorMessage: message } : r
        )
      )
      dbPut({ ...toStore, status: nextStatus, errorMessage: message } as StoredResource)

      // Auto-retry: while offline wait for the `online` event to wake us up;
      // while online use exponential backoff (covers transient FK races where
      // the parent message/task hasn't replayed from the outbox yet).
      const attempt = (retryAttempts.current.get(id) ?? 0) + 1
      retryAttempts.current.set(id, attempt)
      if (shouldAutoRetry(attempt, navigator.onLine)) {
        const delay = nextRetryDelay(attempt)
        const timer = setTimeout(() => {
          retryTimers.current.delete(id)
          doUploadRef.current(id)
        }, delay)
        retryTimers.current.set(id, timer)
      }
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

      // Null time, or a time already past, uploads now rather than arming a
      // negative timeout. The `!scheduledAt` arm is redundant with
      // scheduleDecision(null) but is what narrows the type below.
      const decision = scheduleDecision(scheduledAt)
      if (!scheduledAt || decision.kind === "now") {
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
      }, decision.delayMs)

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
    const retryTimer = retryTimers.current.get(id)
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimers.current.delete(id)
    }
    retryAttempts.current.delete(id)
    setPendingSync((prev) => {
      const r = prev.find((x) => x.id === id)
      if (r) URL.revokeObjectURL(r.objectUrl)
      return prev.filter((x) => x.id !== id)
    })
    dbDelete(id)
  }, [setPendingSync])

  const retryUpload = useCallback(
    (id: string) => {
      // Manual retry resets the auto-backoff counter so the user gets a fresh
      // sequence if the next attempt also fails.
      retryAttempts.current.set(id, 0)
      const retryTimer = retryTimers.current.get(id)
      if (retryTimer) {
        clearTimeout(retryTimer)
        retryTimers.current.delete(id)
      }
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
