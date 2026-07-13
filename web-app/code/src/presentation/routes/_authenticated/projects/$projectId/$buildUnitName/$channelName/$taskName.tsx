import { createFileRoute } from '@tanstack/react-router'
import { TaskPage } from '../../../../../../pages/TaskPage'
import { RoutePendingComponent } from '../../../../../../components/buildInlime'
import { useTaskRoute } from '../../../../../../hooks/use-task-route'
import { useBuildUnitContext, useChannelContext } from '../../../../../../contexts/route-contexts'

export const Route = createFileRoute('/_authenticated/projects/$projectId/$buildUnitName/$channelName/$taskName')({
  component: TaskRoute,
  pendingComponent: RoutePendingComponent,
})

function TaskRoute() {
  const { projectId, buildUnitName, channelName, taskName } = Route.useParams()
  const { buildUnitId, projectName } = useBuildUnitContext()
  const { channelId } = useChannelContext()
  const result = useTaskRoute(channelId, taskName)

  if (result.status === 'loading') {
    return <div className="flex h-screen items-center justify-center text-[#717182]">Loading…</div>
  }

  if (result.status === 'not-found-task') {
    return (
      <div className="flex h-screen items-center justify-center text-[#717182]">
        Task "{taskName}" not found.
      </div>
    )
  }

  const {
    taskId,
    taskDescription,
    properties,
    channelMemberIds,
    currentAssigneeId,
    currentUserId,
    createdByName,
    createdAt,
    canAssign,
  } = result

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
      currentUserId={currentUserId}
      createdByName={createdByName}
      createdAt={createdAt}
      canAssign={canAssign}
    />
  )
}
