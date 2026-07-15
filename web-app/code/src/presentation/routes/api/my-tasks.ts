import { createFileRoute } from "@tanstack/react-router"
import { auth } from "../../../infrastructure/auth/server"
import { prepareElectricUrl, proxyElectricRequest } from "../../../infrastructure/database/electric-proxy"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The current user's TASKS slice: only tasks assigned to them.
 *
 * Mirror of inbox-mentions, for the Sidebar "My Tasks" badge. Without it the
 * badge held the FULL channel-scoped `tasks` collection to count the few assigned
 * to you. Here the server filters by assignee, so the badge subscribes to a tiny
 * user-scoped shape and the full `tasks` collection is freed to garbage-collect
 * when no channel/task view is open.
 *
 * Scoping:
 *   - channel_id = ANY(member_channel_ids): membership gate, same rationale as
 *     inbox-mentions.
 *   - assignee_id = me: the assignment filter.
 *   - deleted_at IS NULL: soft-deleted tasks fall out of the shape (tasks have no
 *     tombstone, unlike messages), matching the main /api/tasks route.
 */
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
  originUrl.searchParams.set(
    `where`,
    channelIds.length === 0
      ? `1 = 0`
      : `channel_id = ANY(ARRAY[${channelIds.map(id => `'${id}'`).join(`,`)}]::text[]) AND assignee_id = '${session.user.id}' AND deleted_at IS NULL`
  )

  return proxyElectricRequest(originUrl)
}

export const Route = createFileRoute("/api/my-tasks")({
  server: {
    handlers: {
      GET: serve,
    },
  },
})
