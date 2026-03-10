import { createFileRoute } from "@tanstack/react-router"
import { auth } from "../../../infrastructure/auth/server"
import { prepareElectricUrl, proxyElectricRequest } from "../../../infrastructure/database/electric-proxy"
import { db } from "../../../infrastructure/database/connection"
import { membershipTable, channelsTable } from "../../../infrastructure/database/schema/admin-schema"
import { eq, and } from "drizzle-orm"

const serve = async ({ request }: { request: Request }) => {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  // Find channels the user belongs to OR owns
  const [userMemberships, ownedChannels] = await Promise.all([
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

  const channelIds = [...new Set([
    ...userMemberships.map(m => m.channel_id),
    ...ownedChannels.map(c => c.id),
  ])]
  if (channelIds.length === 0) {
    return new Response(`[]`, { status: 200, headers: { "content-type": "application/json" } })
  }

  // Return all active memberships for those channels (all members, not just current user)
  const originUrl = prepareElectricUrl(request.url)
  originUrl.searchParams.set(`table`, `memberships`)
  originUrl.searchParams.set(
    `where`,
    `channel_id = ANY(ARRAY[${channelIds.map(id => `'${id}'`).join(`,`)}]::text[]) AND member_flag = true`
  )

  return proxyElectricRequest(originUrl)
}

export const Route = createFileRoute(`/api/memberships`)({
  server: {
    handlers: {
      GET: serve,
    },
  },
})
