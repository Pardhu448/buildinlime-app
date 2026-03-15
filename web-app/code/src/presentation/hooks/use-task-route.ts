import { useLiveQuery, eq } from "@tanstack/react-db"
import { useSession } from '%/infrastructure/auth/client'
import {
  tasksCollection,
  propertiesCollection,
  membershipsCollection,
} from '%/infrastructure/database/tanstack-db-electric/admincollections'
import { unwrapJsonb } from '%/presentation/lib/utils'
import type { Property } from '%/infrastructure/database/schema/admin-schema'

export type TaskRouteStatus =
  | 'loading'
  | 'not-found-task'
  | 'ready'

// channelId is pre-resolved by the $channelName layout route via ChannelContext —
// no need to re-query projects, buildUnits, or channels here.
export function useTaskRoute(channelId: string, taskName: string) {
  const { data: session } = useSession()

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

  if (dbTasks === undefined) return { status: 'loading' as const }
  if (!task) return { status: 'not-found-task' as const }

  const channelMemberIds: string[] = (channelMembershipsData ?? []).map((m) => m.user_id)
  const currentAssigneeId = (task.assignee_id as string | null) ?? null
  const currentUserId = session?.user?.id ?? ''

  const properties: Property[] = (dbTaskProperties ?? []).map((p) => ({
    ...p,
    type: unwrapJsonb(p.type) as Property['type'],
    entity: unwrapJsonb(p.entity) as Property['entity'],
    status_value: unwrapJsonb(p.status_value) as Property['status_value'],
    priority_value: unwrapJsonb(p.priority_value) as Property['priority_value'],
  }))

  return {
    status: 'ready' as const,
    taskId,
    taskDescription: task.description ?? '',
    properties,
    channelMemberIds,
    currentAssigneeId,
    currentUserId,
  }
}
