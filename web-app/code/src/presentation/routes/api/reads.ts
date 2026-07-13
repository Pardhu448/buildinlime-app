import { createFileRoute } from "@tanstack/react-router"
import { auth } from "../../../infrastructure/auth/server"
import { prepareElectricUrl, proxyElectricRequest } from "../../../infrastructure/database/electric-proxy"

/**
 * A user's own read state, and only their own.
 *
 * The `user_id = me` clause is session-derived and unconditional — there is no
 * query parameter to widen it. That scoping is what makes read state cheap: a
 * read row is private, so marking a message read syncs to nobody else, unlike a
 * `read_by` column on the shared message row which would dirty a row every
 * channel member holds. See §3 of mobileUiAndShapeBudget.md.
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
  originUrl.searchParams.set(`table`, `reads`)
  originUrl.searchParams.set(`where`, `user_id = '${session.user.id}'`)

  return proxyElectricRequest(originUrl)
}

export const Route = createFileRoute("/api/reads")({
  server: {
    handlers: {
      GET: serve,
    },
  },
})
