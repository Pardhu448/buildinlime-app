import { createFileRoute } from "@tanstack/react-router"
import { auth } from "../../../infrastructure/auth/server"
import { prepareElectricUrl, proxyElectricRequest } from "../../../infrastructure/database/electric-proxy"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The current user's INBOX slice: only messages that mention them.
 *
 * This exists so the always-mounted Sidebar inbox badge does not have to hold the
 * FULL channel-scoped `messages` collection (every message in every channel you
 * belong to) just to count the handful that mention you. That superset is what
 * pinned `messages` open for the whole session and forced it to materialise in
 * memory + OPFS on every screen. Here the server does the mention filter, so the
 * badge subscribes to a tiny user-scoped shape instead.
 *
 * Scoping is BOTH clauses:
 *   - channel_id = ANY(member_channel_ids): you must still be a member. A mention
 *     in a channel you were removed from must not badge you (and its full message
 *     would not be in your channel-scoped `messages` shape to click through to).
 *   - mention_ids @> ARRAY[me]: the actual mention filter. Electric supports the
 *     @> array-contains operator in shape where clauses (verified against the
 *     running service).
 *
 * NO `deleted_at IS NULL` needed, unlike my-tasks: messages.delete REDACTS in
 * place and CLEARS mention_ids, so a deleted message no longer matches @>[me] and
 * drops out of this slice on its own.
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
  originUrl.searchParams.set(`table`, `messages`)
  originUrl.searchParams.set(
    `where`,
    channelIds.length === 0
      ? `1 = 0`
      : `channel_id = ANY(ARRAY[${channelIds.map(id => `'${id}'`).join(`,`)}]::text[]) AND mention_ids @> ARRAY['${session.user.id}']::text[]`
  )

  return proxyElectricRequest(originUrl)
}

export const Route = createFileRoute("/api/inbox-mentions")({
  server: {
    handlers: {
      GET: serve,
    },
  },
})
