import { createFileRoute } from "@tanstack/react-router"
import { promises as fs } from "node:fs"
import path from "node:path"
import { auth } from "../../../../infrastructure/auth/server"
import { db } from "../../../../infrastructure/database/connection"
import {
  resourcesTable,
  resourcesRawTable,
  messagesTable,
} from "../../../../infrastructure/database/schema/admin-schema"
import { sql, eq } from "drizzle-orm"

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

  // If a messageId was supplied, the message is created optimistically on the client
  // (collection.insert resolves before the onInsert tRPC call completes).
  // Poll up to 3 seconds for the message to land in the DB before inserting the resource FK.
  if (messageId) {
    const deadline = Date.now() + 3000
    while (Date.now() < deadline) {
      const rows = await db
        .select({ id: messagesTable.id })
        .from(messagesTable)
        .where(eq(messagesTable.id, messageId))
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

      const [resource] = await tx
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
        .returning()

      await tx.insert(resourcesRawTable).values({
        id: rawId,
        resource_id: resourceId,
        storage_path: storagePath,
        original_filename: originalFilename,
        mime_type: mimeType,
        file_size_bytes: fileSizeBytes,
      })

      return { resource, txid }
    })

    return new Response(JSON.stringify(createdResource), {
      status: 201,
      headers: { "content-type": "application/json" },
    })
  } catch (err) {
    // Clean up the file if the DB insert failed
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
  server: {
    handlers: {
      POST: handleUpload,
    },
  },
})
