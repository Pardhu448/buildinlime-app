import { createFileRoute } from "@tanstack/react-router"
import { auth } from "../../../infrastructure/auth/server"
import { prepareElectricUrl, proxyElectricRequest } from "../../../infrastructure/database/electric-proxy"
import { db } from "../../../infrastructure/database/connection"
import { membershipTable, channelsTable, buildUnitsTable } from "../../../infrastructure/database/schema/admin-schema"
import { eq, and, inArray } from "drizzle-orm"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const serve = async ({ request }: { request: Request }) => {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  const [memberships, ownedChannels] = await Promise.all([
    db
      .select({ channel_id: membershipTable.channel_id })
      .from(membershipTable)
      .where(and(
        eq(membershipTable.user_id, session.user.id),
        eq(membershipTable.member_flag, true)
      )),
    db
      .select({ id: channelsTable.id })
      .from(channelsTable)
      .where(eq(channelsTable.owner_id, session.user.id)),
  ])

  let channelIds = [...new Set([
    ...memberships.map(m => m.channel_id),
    ...ownedChannels.map(c => c.id),
  ])]
  if (channelIds.length === 0) {
    return new Response(`[]`, { status: 200, headers: { "content-type": "application/json" } })
  }

  const projectId = new URL(request.url).searchParams.get(`project_id`)
  if (projectId && UUID_REGEX.test(projectId)) {
    const projectBuildUnits = await db
      .select({ id: buildUnitsTable.id })
      .from(buildUnitsTable)
      .where(eq(buildUnitsTable.project_id, projectId))
    const projectBuildUnitIds = projectBuildUnits.map(b => b.id)
    if (projectBuildUnitIds.length > 0) {
      const projectChannels = await db
        .select({ id: channelsTable.id })
        .from(channelsTable)
        .where(inArray(channelsTable.buildunit_id, projectBuildUnitIds))
      const projectChannelIds = new Set(projectChannels.map(c => c.id))
      channelIds = channelIds.filter(id => projectChannelIds.has(id))
    } else {
      channelIds = []
    }
  }

  if (channelIds.length === 0) {
    return new Response(`[]`, { status: 200, headers: { "content-type": "application/json" } })
  }

  const originUrl = prepareElectricUrl(request.url)
  originUrl.searchParams.set(`table`, `tasks`)
  originUrl.searchParams.set(`where`, `channel_id = ANY(ARRAY[${channelIds.map(id => `'${id}'`).join(`,`)}]::text[])`)

  return proxyElectricRequest(originUrl)
}

export const Route = createFileRoute("/api/tasks")({
  server: {
    handlers: {
      GET: serve,
    },
  },
})
