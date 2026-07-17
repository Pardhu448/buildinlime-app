import { createFileRoute } from "@tanstack/react-router"
import { auth } from "../../../infrastructure/auth/server"
import { prepareElectricUrl, proxyElectricRequest } from "../../../infrastructure/database/electric-proxy"
import { resolveMemberScope, idSetWhere } from "../../../infrastructure/database/access-scope"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Buildunit set resolved server-side from the session (membership-derived), never
// from a client `member_ids` param — closes the IDOR. Owned buildunits are added
// via owner_id.
const serve = async ({ request }: { request: Request }) => {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  const { buildunitIds } = await resolveMemberScope(session.user.id)

  const parts: string[] = []
  if (buildunitIds.length > 0) parts.push(idSetWhere(`id`, buildunitIds))
  parts.push(`owner_id = '${session.user.id}'`)
  let whereClause = `(${parts.join(` OR `)})`

  // Optional narrowing filter (a specific project). AND-ed with the access
  // boundary above, so it can only restrict — never broaden — visibility.
  const projectId = new URL(request.url).searchParams.get(`project_id`)
  if (projectId && UUID_REGEX.test(projectId)) {
    whereClause += ` AND project_id = '${projectId}'`
  }

  const originUrl = prepareElectricUrl(request.url)
  originUrl.searchParams.set(`table`, `build_units`)
  originUrl.searchParams.set(`where`, whereClause)

  return proxyElectricRequest(originUrl)
}

export const Route = createFileRoute("/api/buildunits")({
  server: {
    handlers: {
      GET: serve,
    },
  },
})
