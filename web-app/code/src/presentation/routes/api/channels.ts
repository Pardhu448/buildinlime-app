import { createFileRoute } from "@tanstack/react-router"
import { auth } from "../../../infrastructure/auth/server"
import { prepareElectricUrl, proxyElectricRequest } from "../../../infrastructure/database/electric-proxy"
import { db } from "../../../infrastructure/database/connection"
import { buildUnitsTable } from "../../../infrastructure/database/schema/admin-schema"
import { eq } from "drizzle-orm"

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
  const memberIds = (url.searchParams.get(`member_ids`) ?? ``).split(`,`).filter(id => UUID_REGEX.test(id))

  const parts: string[] = []
  if (memberIds.length > 0) {
    parts.push(`id = ANY(ARRAY[${memberIds.map(id => `'${id}'`).join(`,`)}]::text[])`)
  }
  parts.push(`owner_id = '${session.user.id}'`)
  let whereClause = `(${parts.join(` OR `)})`

  // Optional project_id filter — narrow to channels belonging to that project's build units
  const projectId = url.searchParams.get(`project_id`)
  if (projectId && UUID_REGEX.test(projectId)) {
    const projectBuildUnits = await db
      .select({ id: buildUnitsTable.id })
      .from(buildUnitsTable)
      .where(eq(buildUnitsTable.project_id, projectId))
    const projectBuildUnitIds = projectBuildUnits.map(b => b.id)
    if (projectBuildUnitIds.length > 0) {
      whereClause += ` AND buildunit_id = ANY(ARRAY[${projectBuildUnitIds.map(id => `'${id}'`).join(`,`)}]::text[])`
    } else {
      whereClause = `1 = 0`
    }
  }

  const originUrl = prepareElectricUrl(request.url)
  originUrl.searchParams.set(`table`, `channels`)
  originUrl.searchParams.set(`where`, whereClause)

  return proxyElectricRequest(originUrl)
}

export const Route = createFileRoute("/api/channels")({
  server: {
    handlers: {
      GET: serve,
    },
  },
})
