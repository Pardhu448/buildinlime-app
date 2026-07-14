import { createFileRoute } from "@tanstack/react-router"
import { auth } from "../../../infrastructure/auth/server"
import { prepareElectricUrl, proxyElectricRequest } from "../../../infrastructure/database/electric-proxy"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const serve = async ({ request }: { request: Request }) => {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  const url = new URL(request.url)
  const channelIds = (url.searchParams.get(`member_channel_ids`) ?? ``).split(`,`).filter(id => UUID_REGEX.test(id))

  const originUrl = prepareElectricUrl(request.url)
  originUrl.searchParams.set(`table`, `tasks`)
  // Soft-deleted tasks are filtered out HERE, not in the UI. A deleted task falls out
  // of the shape, Electric delivers that to clients as a delete, and it disappears
  // from every screen at once — the sheet, My Tasks, the badges — with no per-call-site
  // filter to forget. (Messages are the exception: their shape keeps deleted rows so
  // the client can render a tombstone, because replies hang off them.)
  originUrl.searchParams.set(
    `where`,
    channelIds.length === 0
      ? `1 = 0`
      : `channel_id = ANY(ARRAY[${channelIds.map(id => `'${id}'`).join(`,`)}]::text[]) AND deleted_at IS NULL`
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
