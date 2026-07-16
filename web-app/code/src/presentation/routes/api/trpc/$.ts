import { createFileRoute } from "@tanstack/react-router"
import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { appRouter } from "%/infrastructure/trpc/routers/index"
import { db } from "%/infrastructure/database/connection"
import { auth } from "%/infrastructure/auth/server"

// Router composition lives in infrastructure/trpc/routers/index.ts so tests can
// import it without this file's createFileRoute/auth/db baggage.
export { appRouter } from "%/infrastructure/trpc/routers/index"
export type { AppRouter } from "%/infrastructure/trpc/routers/index"

const serve = ({ request }: { request: Request }) => {
  return fetchRequestHandler({
    endpoint: `/api/trpc`,
    req: request,
    router: appRouter,
    createContext: async () => ({
      db,
      session: await auth.api.getSession({ headers: request.headers }),
    }),
  })
}

export const Route = createFileRoute(`/api/trpc/$`)({
  server: {
    handlers: {
      GET: serve,
      POST: serve,
    },
  },
})