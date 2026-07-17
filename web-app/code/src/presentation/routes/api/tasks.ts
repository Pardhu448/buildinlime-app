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
  originUrl.searchParams.set(`table`, `tasks`)
  // Soft-deleted tasks are filtered out HERE, not in the UI. A deleted task falls out
  // of the shape, Electric delivers that to clients as a delete, and it disappears
  // from every screen at once — the sheet, My Tasks, the badges — with no per-call-site
  // filter to forget. (Messages are the exception: their shape keeps deleted rows so
  // the client can render a tombstone, because replies hang off them.)
  originUrl.searchParams.set(
    `where`,
    `${idSetWhere(`channel_id`, channelIds)} AND deleted_at IS NULL`
  )

  return proxyElectricRequest(originUrl)
}

export const Route = createFileRoute("/api/tasks")({
  server: {
    handlers: {
      GET: serve,
    },
  },
})
