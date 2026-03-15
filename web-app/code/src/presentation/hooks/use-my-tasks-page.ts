import { useNavigate } from "@tanstack/react-router"
import { useLiveQuery, eq } from "@tanstack/react-db"
import { useSession } from "%/infrastructure/auth/client"
import {
  tasksCollection,
  channelsCollection,
  buildUnitsCollection,
  projectsCollection,
} from "%/infrastructure/database/tanstack-db-electric/admincollections"
import { unwrapJsonb } from "%/presentation/lib/utils"

export function useMyTasksPage() {
  const { data: session } = useSession()
  const navigate = useNavigate()
  const currentUserId = session?.user?.id ?? ""

  const { data: myTasks } = useLiveQuery(
    (q) => q.from({ tasksCollection }).where(({ tasksCollection: t }) => eq(t.assignee_id, currentUserId)),
    [currentUserId]
  )
  const { data: allChannels } = useLiveQuery((q) => q.from({ channelsCollection }), [])
  const { data: allBuildUnits } = useLiveQuery((q) => q.from({ buildUnitsCollection }), [])
  const { data: allProjects } = useLiveQuery((q) => q.from({ projectsCollection }), [])

  const getChannel = (channelId: string) => (allChannels ?? []).find((c) => c.id === channelId)
  const getBuildUnit = (buildunitId: string) => (allBuildUnits ?? []).find((b) => b.id === buildunitId)
  const getProject = (projectId: string) => (allProjects ?? []).find((p) => p.id === projectId)

  const sorted = (myTasks ?? []).slice().sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    return 0
  })

  const openCount = sorted.filter((t) => !t.completed).length
  const doneCount = sorted.filter((t) => t.completed).length

  const handleTaskClick = (task: NonNullable<typeof myTasks>[number]) => {
    const channel = getChannel(task.channel_id)
    const buildUnit = getBuildUnit(task.buildunit_id)
    if (!channel || !buildUnit) return
    const channelName = unwrapJsonb(channel.name)
    navigate({
      to: "/projects/$projectId/$buildUnitName/$channelName/$taskName",
      params: {
        projectId: buildUnit.project_id,
        buildUnitName: buildUnit.name,
        channelName,
        taskName: task.name,
      },
    })
  }

  return {
    currentUserId,
    sorted,
    openCount,
    doneCount,
    getChannel,
    getBuildUnit,
    getProject,
    handleTaskClick,
  }
}
