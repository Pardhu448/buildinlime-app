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
  const projectIds = (url.searchParams.get(`member_project_ids`) ?? ``).split(`,`).filter(id => UUID_REGEX.test(id))
  const buildunitIds = (url.searchParams.get(`member_buildunit_ids`) ?? ``).split(`,`).filter(id => UUID_REGEX.test(id))
  const channelIds = (url.searchParams.get(`member_channel_ids`) ?? ``).split(`,`).filter(id => UUID_REGEX.test(id))
  const taskIds = (url.searchParams.get(`member_task_ids`) ?? ``).split(`,`).filter(id => UUID_REGEX.test(id))

  const allIds = [...new Set([...projectIds, ...buildunitIds, ...channelIds, ...taskIds])]

  const originUrl = prepareElectricUrl(request.url)
  originUrl.searchParams.set(`table`, `properties`)
  originUrl.searchParams.set(
    `where`,
    allIds.length === 0
      ? `1 = 0`
      : `entity_id = ANY(ARRAY[${allIds.map(id => `'${id}'`).join(`,`)}]::text[])`
  )

  return proxyElectricRequest(originUrl)
}

export const Route = createFileRoute("/api/properties")({
  server: {
    handlers: {
      GET: serve,
    },
  },
})
