import { createFileRoute } from "@tanstack/react-router"
import { auth } from "../../../infrastructure/auth/server"
import { prepareElectricUrl, proxyElectricRequest } from "../../../infrastructure/database/electric-proxy"
import { resolveMemberScope } from "../../../infrastructure/database/access-scope"

// Property rows attach to an entity via `entity_id`, which may be a project,
// buildunit, channel, or task id. The full entity scope is resolved server-side
// from the session (never from client `member_*_ids` params) — closes the IDOR.
const serve = async ({ request }: { request: Request }) => {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  const { channelIds, buildunitIds, projectIds } = await resolveMemberScope(session.user.id)

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
  // Owner escape hatch (always present, session-derived): properties YOU created
  // sync even on an entity with no membership yet — e.g. a build-unit or project
  // that has no channel. Mirrors the `owner_id = me` clause on the entity shapes.
  clauses.push(`createdby_id = '${session.user.id}'`)

  const originUrl = prepareElectricUrl(request.url)
  originUrl.searchParams.set(`table`, `properties`)
  originUrl.searchParams.set(`where`, clauses.join(` OR `))

  return proxyElectricRequest(originUrl)
}

export const Route = createFileRoute("/api/properties")({
  server: {
    handlers: {
      GET: serve,
    },
  },
})
