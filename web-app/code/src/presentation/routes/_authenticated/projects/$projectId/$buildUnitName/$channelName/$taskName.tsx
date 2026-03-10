import { createFileRoute } from '@tanstack/react-router'
import { useLiveQuery, eq } from "@tanstack/react-db"
import { useSession } from '%/infrastructure/auth/client'
import { TaskPage } from '../../../../../../pages/TaskPage'
import {
  projectsCollection,
  buildUnitsCollection,
  channelsCollection,
  tasksCollection,
  propertiesCollection,
  resourcesCollection,
  membershipsCollection,
} from '%/infrastructure/database/tanstack-db-electric/admincollections'
import { RoutePendingComponent } from '../../../../../../components/buildInlime/RoutePendingComponent'
import { unwrapJsonb } from '%/presentation/lib/utils'
import type { Property } from '%/infrastructure/database/schema/admin-schema'

export const Route = createFileRoute('/_authenticated/projects/$projectId/$buildUnitName/$channelName/$taskName')({
  component: TaskRoute,
  loader: async () => {
    await Promise.all([
      channelsCollection.preload(),
      tasksCollection.preload(),
      propertiesCollection.preload(),
      resourcesCollection.preload(),
    ])
  },
  pendingComponent: RoutePendingComponent,
})

function TaskRoute() {
  const { projectId, buildUnitName, channelName, taskName } = Route.useParams()
  const { data: session } = useSession()

  const { data: dbProjects } = useLiveQuery(
    (q) => q.from({ projectsCollection }).where(({ projectsCollection: p }) => eq(p.id, projectId)),
    [projectId]
  )

  const { data: dbBuildUnits } = useLiveQuery(
    (q) => q.from({ buildUnitsCollection }).where(({ buildUnitsCollection: bu }) => eq(bu.project_id, projectId)),
    [projectId]
  )

  const buildUnit = (dbBuildUnits ?? []).find((bu) => bu.name === buildUnitName)
  const buildUnitId = buildUnit?.id ?? ''

  const { data: dbChannels } = useLiveQuery(
    (q) => q.from({ channelsCollection }).where(({ channelsCollection: c }) => eq(c.buildunit_id, buildUnitId)),
    [buildUnitId]
  )

  const channel = (dbChannels ?? []).find((c) => {
    const raw = c.name as unknown as string
    const name = raw.startsWith('"') ? JSON.parse(raw) : raw
    return name === channelName
  })
  const channelId = channel?.id ?? ''

  const { data: dbTasks } = useLiveQuery(
    (q) => q.from({ tasksCollection }).where(({ tasksCollection: t }) => eq(t.channel_id, channelId)),
    [channelId]
  )

  const task = (dbTasks ?? []).find((t) => t.name === taskName)
  const taskId = task?.id ?? ''

  const { data: dbTaskProperties } = useLiveQuery(
    (q) => q.from({ propertiesCollection }).where(({ propertiesCollection: p }) => eq(p.entity_id, taskId)),
    [taskId]
  )

  const { data: channelMembershipsData } = useLiveQuery(
    (q) => q.from({ membershipsCollection }).where(({ membershipsCollection: m }) => eq(m.channel_id, channelId)),
    [channelId]
  )

  // --- Existence guards (after all hooks) ---

  if (dbBuildUnits === undefined) {
    return <div className="flex h-screen items-center justify-center text-[#717182]">Loading…</div>
  }

  if (!buildUnit) {
    return (
      <div className="flex h-screen items-center justify-center text-[#717182]">
        Build unit "{buildUnitName}" not found.
      </div>
    )
  }

  if (dbChannels === undefined) {
    return <div className="flex h-screen items-center justify-center text-[#717182]">Loading…</div>
  }

  if (!channel) {
    return (
      <div className="flex h-screen items-center justify-center text-[#717182]">
        Channel "{channelName}" not found.
      </div>
    )
  }

  if (dbTasks === undefined) {
    return <div className="flex h-screen items-center justify-center text-[#717182]">Loading…</div>
  }

  if (!task) {
    return (
      <div className="flex h-screen items-center justify-center text-[#717182]">
        Task "{taskName}" not found.
      </div>
    )
  }

  // --- Render ---

  const projectName = dbProjects?.[0]?.name ?? 'Project'
  const taskDescription = task.description ?? ''
  const channelMemberIds: string[] = (channelMembershipsData ?? []).map(m => m.user_id)
  const currentAssigneeId = (task.assignee_id as string | null) ?? null

  const properties: Property[] = (dbTaskProperties ?? []).map((p) => ({
    ...p,
    type: unwrapJsonb(p.type) as Property['type'],
    entity: unwrapJsonb(p.entity) as Property['entity'],
    status_value: unwrapJsonb(p.status_value) as Property['status_value'],
    priority_value: unwrapJsonb(p.priority_value) as Property['priority_value'],
  }))

  return (
    <TaskPage
      projectId={projectId}
      projectName={projectName}
      buildUnitName={buildUnitName}
      buildUnitId={buildUnitId}
      channelName={channelName}
      channelId={channelId}
      taskId={taskId}
      taskName={taskName}
      taskDescription={taskDescription}
      properties={properties}
      channelMemberIds={channelMemberIds}
      currentAssigneeId={currentAssigneeId}
      currentUserId={session?.user?.id ?? ""}
    />
  )
}
