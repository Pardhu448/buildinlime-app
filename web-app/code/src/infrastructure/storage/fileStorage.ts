import path from "node:path"
import { getStorage } from "./index"
import { auth } from "%/infrastructure/auth/server"
import { db } from "%/infrastructure/database/connection"
import {
  resourcesTable,
  resourcesRawTable,
  messagesTable,
  membershipTable,
  tasksTable,
} from "%/infrastructure/database/schema/admin-schema"
import { sql, eq, and } from "drizzle-orm"
import type { ByteRange } from "./provider"

// Parse a single-range HTTP `Range` header against a known object size.
//   - null            → no (usable) Range header; serve the whole object (200).
//   - "unsatisfiable" → a syntactically valid range that falls outside the file (416).
//   - ByteRange       → the inclusive slice to serve (206).
// Only single ranges are handled; a multi-range header (a comma) is treated as
// absent and the full object is served — media players only ever ask for one.
export function parseRangeHeader(
  header: string | null,
  size: number
): ByteRange | "unsatisfiable" | null {
  if (!header) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return null
  const [, startStr, endStr] = match
  if (startStr === "" && endStr === "") return null

  let start: number
  let end: number
  if (startStr === "") {
    // Suffix form `bytes=-N`: the last N bytes.
    const suffix = Number(endStr)
    if (suffix === 0) return "unsatisfiable"
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number(startStr)
    end = endStr === "" ? size - 1 : Number(endStr)
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  // A start at or past EOF cannot be served; an empty file satisfies no range.
  if (size === 0 || start >= size || start > end) return "unsatisfiable"
  if (end >= size) end = size - 1
  return { start, end }
}

export async function handleFileUpload(request: Request): Promise<Response> {
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
  const channelId = formData.get("channelId") as string | null
  const messageId = (formData.get("messageId") as string | null) ?? undefined
  const taskId = (formData.get("taskId") as string | null) ?? undefined
  const buildunitId = formData.get("buildunitId") as string | null
  const projectId = formData.get("projectId") as string | null
  if (!file || !resourceId || !name || !channelId || !buildunitId || !projectId) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: file, resourceId, name, channelId, buildunitId, projectId" }),
      { status: 400, headers: { "content-type": "application/json" } }
    )
  }

  const mimeType = file.type || "application/octet-stream"
  const originalFilename = file.name
  const fileSizeBytes = file.size

  // Sanitise filename to prevent path traversal
  const safeFilename = path.basename(originalFilename).replace(/[^a-zA-Z0-9._-]/g, "_")
  const storageKey = `resources/${resourceId}/${safeFilename}`
  const fileLocation = `/api/resources/${resourceId}/file`

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    await getStorage().put(storageKey, buffer, { contentType: mimeType })
  } catch (err) {
    console.error("File write error:", err)
    return new Response(JSON.stringify({ error: "Failed to save file" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }

  // Parent rows are created optimistically on the client through
  // @tanstack/offline-transactions; the outbox replay can add several seconds
  // of latency on top of the tRPC round-trip. Poll up to 15s for the parent.
  const parentTable = messageId ? messagesTable : taskId ? tasksTable : null
  const parentId = messageId ?? taskId ?? null
  if (parentTable && parentId) {
    const deadline = Date.now() + 15000
    while (Date.now() < deadline) {
      const rows = await db
        .select({ id: parentTable.id })
        .from(parentTable)
        .where(eq(parentTable.id, parentId))
        .limit(1)
      if (rows.length > 0) break
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
  }

  try {
    const rawId = crypto.randomUUID()

    const createdResource = await db.transaction(async (tx) => {
      const txidResult = await tx.execute(
        sql`SELECT pg_current_xact_id()::xid::text as txid`
      )
      const txid = parseInt(txidResult.rows[0]?.txid as string, 10)

      const [inserted] = await tx
        .insert(resourcesTable)
        .values({
          id: resourceId,
          name,
          description,
          file_location: fileLocation,
          mime_type: mimeType,
          file_size_bytes: fileSizeBytes,
          message_id: messageId ?? null,
          task_id: taskId ?? null,
          channel_id: channelId,
          buildunit_id: buildunitId,
          project_id: projectId,
          createdby_id: session.user.id,
        })
        .onConflictDoNothing()
        .returning()

      // Idempotent retry: a prior attempt may have already committed this
      // resource — the client never received the 201 and retried, or a remount
      // / reconnect re-fired the upload. onConflictDoNothing turns the duplicate
      // into a no-op; we reuse the existing row and skip the raw insert rather
      // than PK-conflicting. The old behavior threw here → 500 → the catch
      // deleted the file → the pending entry stayed "failed" next to the already
      // synced resource (the reported double entry).
      let resource = inserted
      if (resource) {
        await tx.insert(resourcesRawTable).values({
          id: rawId,
          resource_id: resourceId,
          storage_path: storageKey,
          original_filename: originalFilename,
          mime_type: mimeType,
          file_size_bytes: fileSizeBytes,
        })
      } else {
        const [existing] = await tx
          .select()
          .from(resourcesTable)
          .where(eq(resourcesTable.id, resourceId))
          .limit(1)
        resource = existing
      }

      return { resource, txid }
    })

    return new Response(JSON.stringify(createdResource), {
      status: 201,
      headers: { "content-type": "application/json" },
    })
  } catch (err) {
    // Clean up the file if the DB insert failed
    await getStorage().delete(storageKey).catch(() => {})
    console.error("DB insert error:", err)
    return new Response(JSON.stringify({ error: "Failed to save resource record" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }
}

export async function serveResourceFile(
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  const { resourceId } = params

  // Look up the resource to get its channel_id
  const [resource] = await db
    .select()
    .from(resourcesTable)
    .where(eq(resourcesTable.id, resourceId))

  // A soft-deleted resource is gone as far as anyone asking for it is concerned.
  // Without this, "deleted" only ever meant "hidden from the UI": the row drops out
  // of the Electric shape, but the bytes stayed downloadable by anyone in the channel
  // holding the URL — and the id is not a secret, it survives in messages.resource_ids
  // and in every client's local store from before the delete. The file also outlives
  // the delete on disk by design (see scripts/purge-resources.ts), so this guard is
  // the only thing standing between a deleted file and whoever asks for it.
  if (!resource || resource.deleted_at) {
    return new Response(JSON.stringify({ error: "Resource not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    })
  }

  // Verify the user has an active membership in the resource's channel
  const channelId = resource.channel_id
  if (channelId) {
    const [membership] = await db
      .select({ id: membershipTable.id })
      .from(membershipTable)
      .where(and(
        eq(membershipTable.user_id, session.user.id),
        eq(membershipTable.channel_id, channelId),
        eq(membershipTable.member_flag, true)
      ))
    if (!membership) {
      return new Response(JSON.stringify({ error: "Resource not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      })
    }
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

  const totalSize = Number(raw.file_size_bytes)
  const range = parseRangeHeader(request.headers.get("range"), totalSize)

  // A range that names bytes outside the file gets 416 + the file's true size, so
  // the client can retry with a valid one (RFC 9110 §15.5.17).
  if (range === "unsatisfiable") {
    return new Response(null, {
      status: 416,
      headers: {
        "content-range": `bytes */${totalSize}`,
        "accept-ranges": "bytes",
      },
    })
  }

  // Fetch only the requested slice off storage when a range was asked for — the
  // player never has to pull the whole file just to seek near the end.
  const obj = await getStorage().get(raw.storage_path, range ? { range } : undefined)
  if (!obj) {
    return new Response(JSON.stringify({ error: "File not found on server" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    })
  }

  // `attachment` is what the download path relies on; native media players read
  // the bytes off the URL directly and ignore the disposition, so it is safe here too.
  const disposition = `attachment; filename="${encodeURIComponent(raw.original_filename)}"`
  const commonHeaders: Record<string, string> = {
    "content-type": raw.mime_type,
    "content-disposition": disposition,
    "cache-control": "private, max-age=3600",
    // Advertised on every response so a client knows it may issue Range requests.
    "accept-ranges": "bytes",
  }

  if (range) {
    const length = range.end - range.start + 1
    return new Response(obj.stream, {
      status: 206,
      headers: {
        ...commonHeaders,
        "content-length": String(length),
        "content-range": `bytes ${range.start}-${range.end}/${totalSize}`,
      },
    })
  }

  return new Response(obj.stream, {
    status: 200,
    headers: {
      ...commonHeaders,
      "content-length": String(totalSize),
    },
  })
}
