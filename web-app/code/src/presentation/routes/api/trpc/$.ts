import { createFileRoute } from "@tanstack/react-router"
import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { router } from "%/infrastructure/trpc/lib/trpc"
import { projectsRouter } from "%/infrastructure/trpc/routers/projects"
import { buildUnitsRouter } from "%/infrastructure/trpc/routers/buildunits"
import { channelsRouter } from "%/infrastructure/trpc/routers/channels"
import { propertiesRouter } from "%/infrastructure/trpc/routers/properties"
import { tasksRouter } from "%/infrastructure/trpc/routers/tasks"
import { usersRouter } from "%/infrastructure/trpc/routers/users"
import { resourcesRouter } from "%/infrastructure/trpc/routers/resources"
import { messagesRouter } from "%/infrastructure/trpc/routers/messages"
import { teamsRouter } from "%/infrastructure/trpc/routers/teams"
import { readsRouter } from "%/infrastructure/trpc/routers/reads"
import { db } from "%/infrastructure/database/connection"
import { auth } from "%/infrastructure/auth/server"

export const appRouter = router({
  projects: projectsRouter,
  buildUnits: buildUnitsRouter,
  channels: channelsRouter,
  properties: propertiesRouter,
  tasks: tasksRouter,
  users: usersRouter,
  resources: resourcesRouter,
  messages: messagesRouter,
  teams: teamsRouter,
  reads: readsRouter,
})

export type AppRouter = typeof appRouter

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