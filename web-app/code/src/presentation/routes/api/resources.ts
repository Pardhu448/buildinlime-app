import { createFileRoute } from "@tanstack/react-router"
import { auth } from "../../../infrastructure/auth/server"
import { prepareElectricUrl, proxyElectricRequest } from "../../../infrastructure/database/electric-proxy"
import { resolveMemberScope, idSetWhere } from "../../../infrastructure/database/access-scope"

// Channel set is resolved server-side from the session (active member or owner),
// never from a client-supplied `member_channel_ids` param — closes the IDOR.
const serve = async ({ request }: { request: Request }) => {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  const { channelIds } = await resolveMemberScope(session.user.id)

  const originUrl = prepareElectricUrl(request.url)
  originUrl.searchParams.set(`table`, `resources`)
  // Soft-deleted resources are filtered out HERE, not in the UI — see the note in
  // api/tasks.ts. A file deleted by its uploader stops syncing to every client, so it
  // vanishes from the channel sheet, the task sheet, and message attachments at once.
  originUrl.searchParams.set(
    `where`,
    `${idSetWhere(`channel_id`, channelIds)} AND deleted_at IS NULL`
  )

  return proxyElectricRequest(originUrl)
}

export const Route = createFileRoute("/api/resources")({
  server: {
    handlers: {
      GET: serve,
    },
  },
})
