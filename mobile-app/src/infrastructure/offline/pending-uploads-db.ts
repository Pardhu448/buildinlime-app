import { openDatabaseSync, deleteDatabaseAsync } from "expo-sqlite"
import type { SQLiteDatabase } from "expo-sqlite"

// SQLite CRUD over the `pending_attachments` table — attachment METADATA only
// (the file bytes are kept as a binary file on disk; see upload-manager.ts).
//
// DEDICATED DATABASE: this table lives in its OWN SQLite file, NOT the main
// collections DB (buildinlime.sqlite). Sharing that connection let upload
// metadata writes contend with Electric's sync-persistence multi-statement
// transactions, producing "database is locked" / "Failed to persist wrapped
// sync transaction" errors — the same contention that forced the offline
// outbox into its own file (see storage.ts). A dedicated file gives this
// table a single, uncontended writer.

const UPLOADS_DB_NAME = "buildinlime-uploads.sqlite"

export type UploadStatus =
  | "awaiting_schedule"
  | "scheduled"
  | "uploading"
  | "awaiting_network"
  | "error"

export interface PendingAttachmentRow {
  resource_id: string
  uri: string
  name: string
  mime_type: string
  channel_id: string
  buildunit_id: string
  project_id: string
  createdby_id: string
  message_id: string | null
  status: UploadStatus
  scheduled_at: string | null
  error_message: string | null
}

let _db: SQLiteDatabase | null = null

function getDb(): SQLiteDatabase {
  if (_db) return _db
  const db = openDatabaseSync(UPLOADS_DB_NAME)
  // WAL + busy_timeout for the same reasons as the other DBs — but since this
  // file has a single writer (the upload manager), real contention is rare.
  db.execSync(`
    PRAGMA journal_mode=WAL;
    PRAGMA busy_timeout=5000;
  `)
  db.execSync(`
    CREATE TABLE IF NOT EXISTS pending_attachments (
      resource_id TEXT PRIMARY KEY NOT NULL,
      uri TEXT NOT NULL,
      name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      buildunit_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      createdby_id TEXT NOT NULL,
      message_id TEXT,
      status TEXT NOT NULL,
      scheduled_at TEXT,
      error_message TEXT
    );
  `)
  _db = db
  return db
}

export async function getAll(): Promise<PendingAttachmentRow[]> {
  return getDb().getAllAsync<PendingAttachmentRow>(
    `SELECT * FROM pending_attachments`,
  )
}

export async function put(row: PendingAttachmentRow): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO pending_attachments
       (resource_id, uri, name, mime_type, channel_id, buildunit_id,
        project_id, createdby_id, message_id, status, scheduled_at, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(resource_id) DO UPDATE SET
       uri = excluded.uri,
       name = excluded.name,
       mime_type = excluded.mime_type,
       channel_id = excluded.channel_id,
       buildunit_id = excluded.buildunit_id,
       project_id = excluded.project_id,
       createdby_id = excluded.createdby_id,
       message_id = excluded.message_id,
       status = excluded.status,
       scheduled_at = excluded.scheduled_at,
       error_message = excluded.error_message`,
    [
      row.resource_id,
      row.uri,
      row.name,
      row.mime_type,
      row.channel_id,
      row.buildunit_id,
      row.project_id,
      row.createdby_id,
      row.message_id,
      row.status,
      row.scheduled_at,
      row.error_message,
    ],
  )
}

export async function updateStatus(
  resourceId: string,
  status: UploadStatus,
  errorMessage?: string | null,
): Promise<void> {
  await getDb().runAsync(
    `UPDATE pending_attachments
       SET status = ?, error_message = ?
     WHERE resource_id = ?`,
    [status, errorMessage ?? null, resourceId],
  )
}

export async function updateSchedule(
  resourceId: string,
  status: UploadStatus,
  scheduledAt: string | null,
): Promise<void> {
  await getDb().runAsync(
    `UPDATE pending_attachments
       SET status = ?, scheduled_at = ?
     WHERE resource_id = ?`,
    [status, scheduledAt, resourceId],
  )
}

export async function remove(resourceId: string): Promise<void> {
  await getDb().runAsync(`DELETE FROM pending_attachments WHERE resource_id = ?`, [
    resourceId,
  ])
}

export async function clear(): Promise<void> {
  await getDb().runAsync(`DELETE FROM pending_attachments`)
}

// Closes and deletes the uploads database. Called on sign-out — the table is
// user-scoped and must not leak the previous user's pending uploads.
export async function disposeUploadsDb(): Promise<void> {
  if (!_db) return
  const db = _db
  _db = null
  try {
    db.closeSync()
    await deleteDatabaseAsync(UPLOADS_DB_NAME)
  } catch {
    // Best-effort — never block sign-out.
  }
}
