import { createFileRoute } from "@tanstack/react-router"
import { promises as fs } from "node:fs"
import { auth } from "../../../../../infrastructure/auth/server"
import { db } from "../../../../../infrastructure/database/connection"
import { resourcesTable, resourcesRawTable, membershipTable } from "../../../../../infrastructure/database/schema/admin-schema"
import { eq, and } from "drizzle-orm"

const serveFile = async ({ request, params }: { request: Request; params: Record<string, string> }) => {
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

  if (!resource) {
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
  server: {
    handlers: {
      GET: serveFile,
    },
  },
})
