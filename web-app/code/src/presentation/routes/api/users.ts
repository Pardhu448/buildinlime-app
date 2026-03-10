import { createFileRoute } from "@tanstack/react-router"
import { auth } from "../../../infrastructure/auth/server"
import { prepareElectricUrl, proxyElectricRequest } from "../../../infrastructure/database/electric-proxy"

const serve = async ({ request }: { request: Request }) => {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  const originUrl = prepareElectricUrl(request.url)
  originUrl.searchParams.set("table", "users")

  return proxyElectricRequest(originUrl)
}

export const Route = createFileRoute("/api/users")({
  server: {
    handlers: {
      GET: serve,
    },
  },
})
