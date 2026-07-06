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

  // Two orthogonal scopes, OR'd together:
  //   - Project & build-unit properties are matched by entity_id (they have no
  //     channel). These change only with membership visibility.
  //   - Channel & task properties are matched by the denormalized channel_id —
  //     the same scope as tasks/messages — so a new task's properties in a
  //     visible channel are covered with no collection rebuild, and member_task_ids
  //     is no longer needed.
  const entityIds = [...new Set([...projectIds, ...buildunitIds])]
  const clauses: string[] = []
  if (entityIds.length > 0) {
    clauses.push(`entity_id = ANY(ARRAY[${entityIds.map(id => `'${id}'`).join(`,`)}]::text[])`)
  }
  if (channelIds.length > 0) {
    clauses.push(`channel_id = ANY(ARRAY[${channelIds.map(id => `'${id}'`).join(`,`)}]::text[])`)
  }

  const originUrl = prepareElectricUrl(request.url)
  originUrl.searchParams.set(`table`, `properties`)
  originUrl.searchParams.set(`where`, clauses.length === 0 ? `1 = 0` : clauses.join(` OR `))

  return proxyElectricRequest(originUrl)
}

export const Route = createFileRoute("/api/properties")({
  server: {
    handlers: {
      GET: serve,
    },
  },
})
