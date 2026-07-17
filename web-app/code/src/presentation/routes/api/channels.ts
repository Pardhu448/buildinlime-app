import { createFileRoute } from "@tanstack/react-router"
import { auth } from "../../../infrastructure/auth/server"
import { prepareElectricUrl, proxyElectricRequest } from "../../../infrastructure/database/electric-proxy"
import { resolveMemberScope, idSetWhere } from "../../../infrastructure/database/access-scope"

// Channel set resolved server-side from the session (member or owner), never from
// a client `member_ids` param — closes the IDOR. resolveMemberScope already
// unions owned channels; owner_id is kept as defense-in-depth.
const serve = async ({ request }: { request: Request }) => {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  const { channelIds } = await resolveMemberScope(session.user.id)

  const parts: string[] = []
  if (channelIds.length > 0) parts.push(idSetWhere(`id`, channelIds))
  parts.push(`owner_id = '${session.user.id}'`)

  const originUrl = prepareElectricUrl(request.url)
  originUrl.searchParams.set(`table`, `channels`)
  originUrl.searchParams.set(`where`, parts.join(` OR `))

  return proxyElectricRequest(originUrl)
}

export const Route = createFileRoute("/api/channels")({
  server: {
    handlers: {
      GET: serve,
    },
  },
})
