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

  // Membership-derived IDs come from the client (via Electric-synced memberships)
  const url = new URL(request.url)
  const memberIds = (url.searchParams.get(`member_ids`) ?? ``).split(`,`).filter(id => UUID_REGEX.test(id))

  const originUrl = prepareElectricUrl(request.url)
  originUrl.searchParams.set(`table`, `projects`)

  const parts: string[] = []
  if (memberIds.length > 0) {
    parts.push(`id = ANY(ARRAY[${memberIds.map(id => `'${id}'`).join(`,`)}]::text[])`)
  }
  parts.push(`owner_id = '${session.user.id}'`)
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
