import { createFileRoute } from "@tanstack/react-router"
import { auth } from "../../../infrastructure/auth/server"
import { prepareElectricUrl, proxyElectricRequest } from "../../../infrastructure/database/electric-proxy"

/**
 * A user's own "last seen" markers, and only their own — the timestamp successor
 * to /api/reads (which stays for mobile).
 *
 * Like reads, the `user_id = me` clause is session-derived and unconditional:
 * there is no query parameter to widen it, and a seen marker is private, so
 * updating it syncs to nobody else. Purely user-scoped, so no membership params
 * and no rebuild on scope change.
 */
const serve = async ({ request }: { request: Request }) => {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  const originUrl = prepareElectricUrl(request.url)
  originUrl.searchParams.set(`table`, `seen_state`)
  originUrl.searchParams.set(`where`, `user_id = '${session.user.id}'`)

  return proxyElectricRequest(originUrl)
}

export const Route = createFileRoute("/api/seen-state")({
  server: {
    handlers: {
      GET: serve,
    },
  },
})
