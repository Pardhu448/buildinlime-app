import { createFileRoute } from "@tanstack/react-router"
import { auth } from "../../../infrastructure/auth/server"
import { prepareElectricUrl, proxyElectricRequest } from "../../../infrastructure/database/electric-proxy"
import { resolveMemberScope, idSetWhere } from "../../../infrastructure/database/access-scope"

// Project set resolved server-side from the session (membership-derived), never
// from a client `member_ids` param — closes the IDOR. Owned projects are added
// via owner_id (an owner may hold no membership row in the project's channels).
const serve = async ({ request }: { request: Request }) => {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  const { projectIds } = await resolveMemberScope(session.user.id)

  const parts: string[] = []
  if (projectIds.length > 0) parts.push(idSetWhere(`id`, projectIds))
  parts.push(`owner_id = '${session.user.id}'`)

  const originUrl = prepareElectricUrl(request.url)
  originUrl.searchParams.set(`table`, `projects`)
  originUrl.searchParams.set(`where`, parts.join(` OR `))

  return proxyElectricRequest(originUrl)
}

export const Route = createFileRoute("/api/projects")({
  server: {
    handlers: {
      GET: serve,
    },
  },
})
