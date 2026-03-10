import { createFileRoute } from "@tanstack/react-router"
import { auth } from "../../../infrastructure/auth/server"
import { prepareElectricUrl, proxyElectricRequest } from "../../../infrastructure/database/electric-proxy"
import { db } from "../../../infrastructure/database/connection"
import { membershipTable, buildUnitsTable } from "../../../infrastructure/database/schema/admin-schema"
import { eq, and } from "drizzle-orm"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const serve = async ({ request }: { request: Request }) => {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  const [memberships, ownedBuildUnits] = await Promise.all([
    db
      .select({ buildunit_id: membershipTable.buildunit_id })
      .from(membershipTable)
      .where(and(
        eq(membershipTable.user_id, session.user.id),
        eq(membershipTable.member_flag, true)
      )),
    db
      .select({ id: buildUnitsTable.id })
      .from(buildUnitsTable)
      .where(eq(buildUnitsTable.owner_id, session.user.id)),
  ])

  const buildunitIds = [...new Set([
    ...memberships.map(m => m.buildunit_id),
    ...ownedBuildUnits.map(b => b.id),
  ])]
  if (buildunitIds.length === 0) {
    return new Response(`[]`, { status: 200, headers: { "content-type": "application/json" } })
  }

  const projectId = new URL(request.url).searchParams.get(`project_id`)
  let whereClause = `id = ANY(ARRAY[${buildunitIds.map(id => `'${id}'`).join(`,`)}]::text[])`
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
