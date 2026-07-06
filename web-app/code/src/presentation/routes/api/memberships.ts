import { createFileRoute } from "@tanstack/react-router"
import { auth } from "../../../infrastructure/auth/server"
import { prepareElectricUrl, proxyElectricRequest } from "../../../infrastructure/database/electric-proxy"

const serve = async ({ request }: { request: Request }) => {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  // STABLE self-membership stream.
  //
  // The where clause depends only on session.user.id — a value that never
  // changes for the life of the session — so it is byte-identical on every
  // long-poll. That keeps Electric's shape handle stable (no churn / 409
  // must-refetch), and ANY new membership row for this user, on ANY channel
  // (including one they were just added to), matches immediately and streams
  // in live. This is the bootstrap source that drives membership-derived
  // visibility and the downstream recreation trigger.
  //
  // Roster display ("who else is in this channel", i.e. OTHER users' rows) is
  // served separately by /api/channel-members so this hot path needs no DB
  // query. session.user.id is server-issued, same trust level as the existing
  // `owner_id = '${session.user.id}'` interpolation in the other shape routes.
  const originUrl = prepareElectricUrl(request.url)
  originUrl.searchParams.set(`table`, `memberships`)
  originUrl.searchParams.set(
    `where`,
    `user_id = '${session.user.id}' AND member_flag = true`,
  )

  return proxyElectricRequest(originUrl)
}

export const Route = createFileRoute(`/api/memberships`)({
  server: {
    handlers: {
      GET: serve,
    },
  },
})
