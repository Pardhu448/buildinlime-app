import { createFileRoute } from "@tanstack/react-router"
import { auth } from "../../../infrastructure/auth/server"
import { prepareElectricUrl, proxyElectricRequest } from "../../../infrastructure/database/electric-proxy"
import { db } from "../../../infrastructure/database/connection"
import { membershipTable, tasksTable, projectsTable, buildUnitsTable, channelsTable } from "../../../infrastructure/database/schema/admin-schema"
import { eq, and, inArray } from "drizzle-orm"

const serve = async ({ request }: { request: Request }) => {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  const [memberships, ownedProjects, ownedBuildUnits, ownedChannels] = await Promise.all([
    db
      .select({
        channel_id: membershipTable.channel_id,
        buildunit_id: membershipTable.buildunit_id,
        project_id: membershipTable.project_id,
      })
      .from(membershipTable)
      .where(and(
        eq(membershipTable.user_id, session.user.id),
        eq(membershipTable.member_flag, true)
      )),
    db.select({ id: projectsTable.id }).from(projectsTable).where(eq(projectsTable.owner_id, session.user.id)),
    db.select({ id: buildUnitsTable.id }).from(buildUnitsTable).where(eq(buildUnitsTable.owner_id, session.user.id)),
    db.select({ id: channelsTable.id }).from(channelsTable).where(eq(channelsTable.owner_id, session.user.id)),
  ])

  const channelIds = [...new Set([...memberships.map(m => m.channel_id), ...ownedChannels.map(c => c.id)])]
  const buildunitIds = [...new Set([...memberships.map(m => m.buildunit_id), ...ownedBuildUnits.map(b => b.id)])]
  const projectIds = [...new Set([...memberships.map(m => m.project_id), ...ownedProjects.map(p => p.id)])]

  if (channelIds.length === 0 && buildunitIds.length === 0 && projectIds.length === 0) {
    return new Response(`[]`, { status: 200, headers: { "content-type": "application/json" } })
  }

  // Also include task IDs for task-level properties
  const tasks = channelIds.length > 0
    ? await db.select({ id: tasksTable.id }).from(tasksTable).where(inArray(tasksTable.channel_id, channelIds))
    : []

  const taskIds = tasks.map(t => t.id)

  const allIds = [...projectIds, ...buildunitIds, ...channelIds, ...taskIds]

  const originUrl = prepareElectricUrl(request.url)
  originUrl.searchParams.set(`table`, `properties`)
  originUrl.searchParams.set(`where`, `entity_id = ANY(ARRAY[${allIds.map(id => `'${id}'`).join(`,`)}]::text[])`)

  return proxyElectricRequest(originUrl)
}

export const Route = createFileRoute("/api/properties")({
  server: {
    handlers: {
      GET: serve,
    },
  },
})
