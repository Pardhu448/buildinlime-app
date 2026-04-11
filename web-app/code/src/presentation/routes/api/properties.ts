import { createFileRoute } from "@tanstack/react-router"
import { auth } from "../../../infrastructure/auth/server"
import { prepareElectricUrl, proxyElectricRequest } from "../../../infrastructure/database/electric-proxy"
import { db } from "../../../infrastructure/database/connection"
import { tasksTable, projectsTable, buildUnitsTable, channelsTable } from "../../../infrastructure/database/schema/admin-schema"
import { eq, inArray } from "drizzle-orm"

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
  const memberProjectIds = (url.searchParams.get(`member_project_ids`) ?? ``).split(`,`).filter(id => UUID_REGEX.test(id))
  const memberBuildunitIds = (url.searchParams.get(`member_buildunit_ids`) ?? ``).split(`,`).filter(id => UUID_REGEX.test(id))
  const memberChannelIds = (url.searchParams.get(`member_channel_ids`) ?? ``).split(`,`).filter(id => UUID_REGEX.test(id))

  // Include owned entities not captured by memberships
  const [ownedProjects, ownedBuildUnits, ownedChannels] = await Promise.all([
    db.select({ id: projectsTable.id }).from(projectsTable).where(eq(projectsTable.owner_id, session.user.id)),
    db.select({ id: buildUnitsTable.id }).from(buildUnitsTable).where(eq(buildUnitsTable.owner_id, session.user.id)),
    db.select({ id: channelsTable.id }).from(channelsTable).where(eq(channelsTable.owner_id, session.user.id)),
  ])

  const channelIds = [...new Set([...memberChannelIds, ...ownedChannels.map(c => c.id)])]
  const buildunitIds = [...new Set([...memberBuildunitIds, ...ownedBuildUnits.map(b => b.id)])]
  const projectIds = [...new Set([...memberProjectIds, ...ownedProjects.map(p => p.id)])]

  // Also include task IDs for task-level properties
  const tasks = channelIds.length > 0
    ? await db.select({ id: tasksTable.id }).from(tasksTable).where(inArray(tasksTable.channel_id, channelIds))
    : []

  const taskIds = tasks.map(t => t.id)
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
