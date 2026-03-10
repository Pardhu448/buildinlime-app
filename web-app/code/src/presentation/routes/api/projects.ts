import { createFileRoute } from "@tanstack/react-router"
import { auth } from "../../../infrastructure/auth/server"
import { prepareElectricUrl, proxyElectricRequest } from "../../../infrastructure/database/electric-proxy"
import { db } from "../../../infrastructure/database/connection"
import { membershipTable, projectsTable } from "../../../infrastructure/database/schema/admin-schema"
import { eq, and } from "drizzle-orm"

const serve = async ({ request }: { request: Request }) => {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  const [memberships, ownedProjects] = await Promise.all([
    db
      .select({ project_id: membershipTable.project_id })
      .from(membershipTable)
      .where(and(
        eq(membershipTable.user_id, session.user.id),
        eq(membershipTable.member_flag, true)
      )),
    db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(eq(projectsTable.owner_id, session.user.id)),
  ])

  const projectIds = [...new Set([
    ...memberships.map(m => m.project_id),
    ...ownedProjects.map(p => p.id),
  ])]
  if (projectIds.length === 0) {
    return new Response(`[]`, { status: 200, headers: { "content-type": "application/json" } })
  }

  const originUrl = prepareElectricUrl(request.url)
  originUrl.searchParams.set(`table`, `projects`)
  originUrl.searchParams.set(`where`, `id = ANY(ARRAY[${projectIds.map(id => `'${id}'`).join(`,`)}]::text[])`)

  return proxyElectricRequest(originUrl)
}

export const Route = createFileRoute("/api/projects")({
  server: {
    handlers: {
      GET: serve,
    },
  },
})
