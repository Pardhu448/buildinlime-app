import { createFileRoute } from "@tanstack/react-router"
import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { router } from "%/infrastructure/trpc/lib/trpc"
import { projectsRouter } from "%/infrastructure/trpc/projects"
import { buildUnitsRouter } from "%/infrastructure/trpc/buildunits"
import { channelsRouter } from "%/infrastructure/trpc/channels"
import { propertiesRouter } from "%/infrastructure/trpc/properties"
import { tasksRouter } from "%/infrastructure/trpc/tasks"
import { usersRouter } from "%/infrastructure/trpc/users"
import { resourcesRouter } from "%/infrastructure/trpc/resources"
import { messagesRouter } from "%/infrastructure/trpc/messages"
import { teamsRouter } from "%/infrastructure/trpc/teams"
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