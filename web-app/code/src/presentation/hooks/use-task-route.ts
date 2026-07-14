import { useLiveQuery, eq } from "@tanstack/react-db"
import { useSession } from '%/infrastructure/auth/client'
import {
  tasksCollection,
  propertiesCollection,
  channelMembersCollection,
  usersCollection,
} from '%/infrastructure/database/tanstack-db-electric/admincollections'
import { unwrapJsonb } from '%/presentation/lib/utils'
import type { Property } from '%/domain/communication/types'

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
    (q) => q.from({ channelMembersCollection }).where(({ channelMembersCollection: m }) => eq(m.channel_id, channelId)),
    [channelId]
  )

  const { data: allUsers } = useLiveQuery((q) => q.from({ usersCollection }), [])

  if (dbTasks === undefined) return { status: 'loading' as const }
  if (!task) return { status: 'not-found-task' as const }
  // Properties MUST be loaded before the page renders, not merely defaulted to [].
  // TaskStatusSection creates a taskStatus property when it cannot find one — so
  // rendering mid-load lets a click create a SECOND taskStatus row for a task that
  // already has one, and the two then disagree about the status forever.
  if (dbTaskProperties === undefined) return { status: 'loading' as const }

  const channelMemberIds: string[] = (channelMembershipsData ?? []).map((m) => m.user_id)
  const currentAssigneeId = (task.assignee_id as string | null) ?? null
  const currentUserId = session?.user?.id ?? ''

  const createdById = (task.createdby_id as string | null) ?? null
  const creator = (allUsers ?? []).find((u) => u.id === createdById)
  const createdByName = creator?.name || creator?.email || 'Unknown'

  const properties: Property[] = (dbTaskProperties ?? []).map((p) => ({
    ...p,
    type: unwrapJsonb(p.type) as Property['type'],
    entity: unwrapJsonb(p.entity) as Property['entity'],
    status_value: unwrapJsonb(p.status_value) as Property['status_value'],
    priority_value: unwrapJsonb(p.priority_value) as Property['priority_value'],
    task_status_value: unwrapJsonb(p.task_status_value) as Property['task_status_value'],
  }))

  return {
    status: 'ready' as const,
    taskId,
    taskDescription: task.description ?? '',
    // Only a fallback for TaskStatusSection: the taskStatus PROPERTY is the source
    // of truth, and this column is what the server writes through from it. It is
    // read only when no taskStatus property exists on the task yet.
    completed: !!task.completed,
    properties,
    channelMemberIds,
    currentAssigneeId,
    currentUserId,
    createdByName,
    createdAt: task.opened_at as Date | string | undefined,
    // Only the creator may assign — mirrored by a FORBIDDEN check in tasks.update.
    canAssign: !!createdById && createdById === currentUserId,
  }
}
