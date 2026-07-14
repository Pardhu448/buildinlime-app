import * as FileSystem from "expo-file-system/legacy"
import * as Crypto from "expo-crypto"
import { createCookieFetch } from "../auth/cookie-fetch"
import { getOnlineDetector } from "./online-detector"
import {
  getAll,
  put,
  updateStatus,
  updateSchedule,
  remove,
  clear,
  disposeUploadsDb,
  type PendingAttachmentRow,
  type UploadStatus,
} from "./pending-uploads-db"

// Upload manager — a SERVICE module, not a hook.
//
// Deliberately NOT a hook: uploads must survive screen unmounts. The manager
// is a singleton started once (initUploadManager, in the tab layout) and
// disposed once (disposeUploadManager, at sign-out), exactly like the offline
// executor.
//
// File uploads stay OUT of @tanstack/offline-transactions: the executor's
// outbox serialises mutations to JSON, and multi-MB binaries do not belong
// there. The upload IS the resource "create" — mobile never inserts a
// `resources` row through the executor. The server creates it on a successful
// upload; Electric then syncs it into resourcesCollection. Until then, the
// pending upload is the optimistic state.

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000"
const UPLOAD_ENDPOINT = `${API_URL}/api/resources/upload`

// Picked files live in OS-managed temp/cache locations that can be reaped at
// any time. Copy them under documentDirectory so a queued upload still has its
// bytes after an app restart.
const UPLOAD_DIR = `${FileSystem.documentDirectory}pending-uploads/`

const MAX_AUTO_RETRIES = 5
const MAX_BACKOFF_MS = 30_000

export type { UploadStatus }

export interface PendingUpload {
  id: string
  uri: string
  name: string
  mimeType: string
  channelId: string
  buildUnitId: string
  projectId: string
  createdById: string
  messageId: string | null
  /** Set when the attachment belongs to a task rather than a message/channel. */
  taskId: string | null
  status: UploadStatus
  scheduledAt: Date | null
  errorMessage?: string
}

export interface EnqueueUploadOptions {
  name: string
  mimeType: string
  channelId: string
  buildUnitId: string
  projectId: string
  createdById: string
  messageId?: string | null
  taskId?: string | null
}

export interface EnqueueControl {
  /**
   * Start uploading immediately (default true). Pass false for message
   * attachments: they must wait in `awaiting_schedule` until the message is
   * sent — only then does startUpload() fire them, so the server's 15s
   * parent-poll finds the message in time.
   */
  autoStart?: boolean
}

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

const uploads = new Map<string, PendingUpload>()
const subscribers = new Set<(uploads: PendingUpload[]) => void>()
const scheduleTimers = new Map<string, ReturnType<typeof setTimeout>>()
const retryTimers = new Map<string, ReturnType<typeof setTimeout>>()
const retryAttempts = new Map<string, number>()
// Ids with a doUpload() POST currently in flight. Tracked separately from the
// persisted `uploading` status so hydration can RESUME an interrupted upload
// (its row still says `uploading`) without doUpload's re-entrancy guard
// rejecting it.
const inFlight = new Set<string>()
let initialized = false
let onlineUnsub: (() => void) | null = null

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

function snapshot(): PendingUpload[] {
  return Array.from(uploads.values())
}

function notify(): void {
  const snap = snapshot()
  for (const cb of subscribers) {
    try {
      cb(snap)
    } catch (err) {
      console.warn(`[uploads] subscriber error:`, err)
    }
  }
}

export function subscribe(cb: (uploads: PendingUpload[]) => void): () => void {
  subscribers.add(cb)
  cb(snapshot())
  return () => subscribers.delete(cb)
}

export function getUploads(): PendingUpload[] {
  return snapshot()
}

// ---------------------------------------------------------------------------
// Row <-> PendingUpload mapping
// ---------------------------------------------------------------------------

function rowToUpload(row: PendingAttachmentRow): PendingUpload {
  return {
    id: row.resource_id,
    uri: row.uri,
    name: row.name,
    mimeType: row.mime_type,
    channelId: row.channel_id,
    buildUnitId: row.buildunit_id,
    projectId: row.project_id,
    createdById: row.createdby_id,
    messageId: row.message_id,
    taskId: row.task_id,
    status: row.status,
    scheduledAt: row.scheduled_at ? new Date(row.scheduled_at) : null,
    errorMessage: row.error_message ?? undefined,
  }
}

function uploadToRow(u: PendingUpload): PendingAttachmentRow {
  return {
    resource_id: u.id,
    uri: u.uri,
    name: u.name,
    mime_type: u.mimeType,
    channel_id: u.channelId,
    buildunit_id: u.buildUnitId,
    project_id: u.projectId,
    createdby_id: u.createdById,
    message_id: u.messageId,
    task_id: u.taskId,
    status: u.status,
    scheduled_at: u.scheduledAt ? u.scheduledAt.toISOString() : null,
    error_message: u.errorMessage ?? null,
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Hydrate the manager from SQLite. Call once, after the persistence DB is
 * ready (tab layout, Phase 2). Interrupted `uploading` rows are reset to
 * `awaiting_schedule` and re-driven; `error`/`awaiting_network` rows are
 * retried; `scheduled` rows get their timers rebuilt.
 */
export async function initUploadManager(): Promise<void> {
  if (initialized) return
  initialized = true

  await FileSystem.makeDirectoryAsync(UPLOAD_DIR, { intermediates: true }).catch(
    () => {},
  )

  let rows: PendingAttachmentRow[] = []
  try {
    rows = await getAll()
  } catch (err) {
    console.warn(`[uploads] hydrate failed:`, err)
  }

  for (const row of rows) {
    uploads.set(row.resource_id, rowToUpload(row))
  }
  notify()

  for (const upload of uploads.values()) {
    // `uploading` — interrupted mid-flight by an app kill: resume it.
    // `error` / `awaiting_network` — a previous attempt failed: retry it.
    if (
      upload.status === "uploading" ||
      upload.status === "error" ||
      upload.status === "awaiting_network"
    ) {
      void doUpload(upload.id)
    } else if (upload.status === "scheduled" && upload.scheduledAt) {
      armScheduleTimer(upload.id, upload.scheduledAt)
    }
    // `awaiting_schedule` — deliberately left alone: a message attachment
    // waiting for its message to be sent, or a file awaiting a schedule.
  }

  // Auto-retry errored / awaiting-network uploads as soon as the shared
  // detector reports we are back online.
  const detector = getOnlineDetector()
  onlineUnsub = detector.subscribe(() => {
    if (!detector.isOnline()) return
    for (const upload of uploads.values()) {
      if (upload.status === "error" || upload.status === "awaiting_network") {
        retryUpload(upload.id)
      }
    }
  })

  if (__DEV__) {
    console.log(`[uploads] Upload manager ready, ${uploads.size} pending`)
  }
}

/**
 * Drop all pending uploads — rows and the copied local files. Called at
 * sign-out: pending uploads are user-scoped, mirroring how the executor's
 * outbox is wiped. In-flight uploads are abandoned (parity with the outbox).
 */
export async function disposeUploadManager(): Promise<void> {
  if (!initialized) return
  initialized = false

  onlineUnsub?.()
  onlineUnsub = null

  for (const t of scheduleTimers.values()) clearTimeout(t)
  for (const t of retryTimers.values()) clearTimeout(t)
  scheduleTimers.clear()
  retryTimers.clear()
  retryAttempts.clear()
  inFlight.clear()

  for (const upload of uploads.values()) {
    await FileSystem.deleteAsync(upload.uri, { idempotent: true }).catch(() => {})
  }
  uploads.clear()
  notify()

  await clear().catch(() => {})
  // Close + delete the dedicated uploads DB file — user-scoped, mirroring how
  // the executor's outbox DB is disposed.
  await disposeUploadsDb().catch(() => {})
}

// ---------------------------------------------------------------------------
// Enqueue
// ---------------------------------------------------------------------------

/**
 * Copy a picked file into durable storage, persist a pending row, and start
 * the upload. Returns the generated resource id (also the upload id).
 */
export async function enqueueUpload(
  fileUri: string,
  opts: EnqueueUploadOptions,
  control: EnqueueControl = {},
): Promise<string> {
  const id = Crypto.randomUUID()
  await FileSystem.makeDirectoryAsync(UPLOAD_DIR, { intermediates: true }).catch(
    () => {},
  )
  const localUri = `${UPLOAD_DIR}${id}`
  await FileSystem.copyAsync({ from: fileUri, to: localUri })

  const upload: PendingUpload = {
    id,
    uri: localUri,
    name: opts.name,
    mimeType: opts.mimeType,
    channelId: opts.channelId,
    buildUnitId: opts.buildUnitId,
    projectId: opts.projectId,
    createdById: opts.createdById,
    messageId: opts.messageId ?? null,
    taskId: opts.taskId ?? null,
    status: "awaiting_schedule",
    scheduledAt: null,
  }
  uploads.set(id, upload)
  await put(uploadToRow(upload))
  notify()

  if (control.autoStart ?? true) void doUpload(id)
  return id
}

/**
 * Start (or restart) an upload that is resting in `awaiting_schedule` — used
 * by MessageInput once the parent message is sent.
 */
export function startUpload(id: string): void {
  void doUpload(id)
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

function setStatus(
  id: string,
  status: UploadStatus,
  errorMessage?: string,
): PendingUpload | undefined {
  const upload = uploads.get(id)
  if (!upload) return undefined
  upload.status = status
  upload.errorMessage = errorMessage
  notify()
  return upload
}

async function doUpload(id: string): Promise<void> {
  const upload = uploads.get(id)
  if (!upload) return
  // Already in flight — online-event retries and the scheduled/backoff timers
  // can all race to call doUpload for the same id.
  if (inFlight.has(id)) return
  inFlight.add(id)

  const existingRetry = retryTimers.get(id)
  if (existingRetry) {
    clearTimeout(existingRetry)
    retryTimers.delete(id)
  }

  setStatus(id, "uploading")
  await updateStatus(id, "uploading").catch(() => {})

  const formData = new FormData()
  // React Native streams the file from disk given a { uri, name, type } part —
  // no base64-in-memory copy.
  formData.append("file", {
    uri: upload.uri,
    name: upload.name,
    type: upload.mimeType,
  } as unknown as Blob)
  formData.append("resourceId", upload.id)
  formData.append("name", upload.name)
  formData.append("channelId", upload.channelId)
  formData.append("buildunitId", upload.buildUnitId)
  formData.append("projectId", upload.projectId)
  if (upload.messageId) formData.append("messageId", upload.messageId)
  // The server reads taskId from the form and sets resources.task_id — without
  // this a task attachment would persist as a plain channel resource.
  if (upload.taskId) formData.append("taskId", upload.taskId)

  try {
    const cookieFetch = createCookieFetch()
    const res = await cookieFetch(UPLOAD_ENDPOINT, {
      method: "POST",
      body: formData,
    })
    if (!res.ok) {
      const err = await res
        .json()
        .catch(() => ({ error: `Upload failed (${res.status})` }))
      throw new Error(err.error ?? `Upload failed (${res.status})`)
    }

    // Success — drop the row and the local file. Electric syncs the new
    // `resources` row into resourcesCollection on its own.
    uploads.delete(id)
    retryAttempts.delete(id)
    notify()
    await remove(id).catch(() => {})
    await FileSystem.deleteAsync(upload.uri, { idempotent: true }).catch(() => {})
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed"
    // Offline isn't really a failure — surface a calmer "awaiting network"
    // state instead of a red error for something we will auto-retry.
    const online = getOnlineDetector().isOnline()
    const nextStatus: UploadStatus = online ? "error" : "awaiting_network"
    setStatus(id, nextStatus, message)
    await updateStatus(id, nextStatus, message).catch(() => {})

    // Auto-retry: while offline the online-detector wakes us on reconnect (see
    // initUploadManager wiring); while online use exponential backoff (covers
    // transient FK races where the parent message hasn't replayed yet).
    const attempt = (retryAttempts.get(id) ?? 0) + 1
    retryAttempts.set(id, attempt)
    if (attempt <= MAX_AUTO_RETRIES && online) {
      const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** (attempt - 1))
      const timer = setTimeout(() => {
        retryTimers.delete(id)
        void doUpload(id)
      }, delay)
      retryTimers.set(id, timer)
    }
  } finally {
    inFlight.delete(id)
  }
}

// ---------------------------------------------------------------------------
// Schedule / cancel / retry
// ---------------------------------------------------------------------------

function armScheduleTimer(id: string, when: Date): void {
  const existing = scheduleTimers.get(id)
  if (existing) clearTimeout(existing)
  const delay = when.getTime() - Date.now()
  if (delay <= 0) {
    void doUpload(id)
    return
  }
  const timer = setTimeout(() => {
    scheduleTimers.delete(id)
    void doUpload(id)
  }, delay)
  scheduleTimers.set(id, timer)
}

/** Defer an upload to a future time (null = upload now). */
export async function scheduleUpload(
  id: string,
  when: Date | null,
): Promise<void> {
  const upload = uploads.get(id)
  if (!upload) return
  const existing = scheduleTimers.get(id)
  if (existing) {
    clearTimeout(existing)
    scheduleTimers.delete(id)
  }
  if (!when || when.getTime() <= Date.now()) {
    void doUpload(id)
    return
  }
  upload.status = "scheduled"
  upload.scheduledAt = when
  notify()
  await updateSchedule(id, "scheduled", when.toISOString()).catch(() => {})
  armScheduleTimer(id, when)
}

/**
 * Rename a pending upload before it goes out. `name` is sent as both the
 * multipart filename and the `name` field (see doUpload), so this is what the
 * resource ends up called on the server.
 *
 * Only meaningful before the bytes leave: once the status is `uploading` the
 * form data is already built, so a rename would silently not apply. Callers get
 * `false` in that case rather than a lie.
 */
export async function renameUpload(id: string, name: string): Promise<boolean> {
  const upload = uploads.get(id)
  if (!upload) return false
  if (upload.status === "uploading") return false

  const trimmed = name.trim()
  if (!trimmed || trimmed === upload.name) return false

  upload.name = trimmed
  notify()
  await put(uploadToRow(upload)).catch(() => {})
  return true
}

/** Drop a pending upload — clears timers, the row, and the local file. */
export async function cancelUpload(id: string): Promise<void> {
  const upload = uploads.get(id)
  const scheduleTimer = scheduleTimers.get(id)
  if (scheduleTimer) {
    clearTimeout(scheduleTimer)
    scheduleTimers.delete(id)
  }
  const retryTimer = retryTimers.get(id)
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimers.delete(id)
  }
  retryAttempts.delete(id)
  uploads.delete(id)
  notify()
  await remove(id).catch(() => {})
  if (upload) {
    await FileSystem.deleteAsync(upload.uri, { idempotent: true }).catch(() => {})
  }
}

/** Manual retry — resets the auto-backoff counter for a fresh sequence. */
export function retryUpload(id: string): void {
  retryAttempts.set(id, 0)
  const retryTimer = retryTimers.get(id)
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimers.delete(id)
  }
  void doUpload(id)
}
