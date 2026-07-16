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
import { seenRouter } from "%/infrastructure/trpc/routers/seen"

// Composed here, outside the TanStack route file, so tests can import the real
// router (e.g. the contract-name parity spec) without dragging in createFileRoute.
// The route handler in routes/api/trpc/$.ts serves this.
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
  seen: seenRouter,
})

export type AppRouter = typeof appRouter
