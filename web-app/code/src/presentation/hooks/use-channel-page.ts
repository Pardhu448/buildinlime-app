import { useState } from "react"
import type { FormEvent } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useLiveQuery, eq } from "@tanstack/react-db"
import { tasksCollection, channelsCollection, usersCollection, channelMembersCollection } from "%/infrastructure/database/tanstack-db-electric/admincollections"
import { trpc } from "%/infrastructure/trpc/lib/trpc-client"
import { useSession } from "%/infrastructure/auth/client"
import { createTaskAction } from "%/application/actions/tasks"

export function useChannelPage(channelId: string, buildUnitId: string, projectId: string, buildUnitName: string, channelName: string) {
  const { data: session } = useSession()
  const navigate = useNavigate()

  // Member management state
  const [isAddingMember, setIsAddingMember] = useState(false)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [pendingRemovals, setPendingRemovals] = useState<Set<string>>(new Set())
  const [removalError, setRemovalError] = useState<string | null>(null)
  const [alreadyMemberName, setAlreadyMemberName] = useState<string | null>(null)

  // Task form state
  const [taskName, setTaskName] = useState("")
  const [taskDesc, setTaskDesc] = useState("")
  const [isSubmittingTask, setIsSubmittingTask] = useState(false)

  // Queries
  const { data: channelData } = useLiveQuery(
    (q) => q.from({ channelsCollection }).where(({ channelsCollection: c }) => eq(c.id, channelId)),
    [channelId]
  )

  const { data: allUsers } = useLiveQuery((q) => q.from({ usersCollection }), [])

  const { data: channelMemberships } = useLiveQuery(
    (q) => q.from({ channelMembersCollection }).where(({ channelMembersCollection: m }) => eq(m.channel_id, channelId)),
    [channelId]
  )

  const { data: dbTasks } = useLiveQuery(
    (q) => q.from({ tasksCollection }).where(({ tasksCollection: t }) => eq(t.channel_id, channelId)),
    [channelId]
  )

  // Derived
  const channelMemberIds = (channelMemberships ?? []).map((m) => m.user_id)
  const channelMembers = (allUsers ?? []).filter((u) => channelMemberIds.includes(u.id) && !pendingRemovals.has(u.id))
  const nonMembers = (allUsers ?? []).filter((u) => !channelMemberIds.includes(u.id) || pendingRemovals.has(u.id))
  const channelOwnerId = channelData?.[0]?.owner_id
  const isOwner = session?.user?.id === channelOwnerId

  const tasks = (dbTasks ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    completed: t.completed,
    // Carried for the panel's unread check (opened_at vs the channel's seen marker).
    opened_at: t.opened_at,
    channel_id: t.channel_id,
  }))

  // Handlers
  const handleAddMember = async (userId: string, onSuccess: () => void) => {
    const user = allUsers?.find((u) => u.id === userId)
    setIsAddingMember(true)
    try {
      await trpc.channels.addMember.mutate({ channelId, userId })
      onSuccess()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes("ALREADY_MEMBER")) {
        setAlreadyMemberName(user?.name || user?.email || userId)
        onSuccess()
      }
    } finally {
      setIsAddingMember(false)
    }
  }

  const handleRemoveMember = async (userId: string, userName: string) => {
    setConfirmRemoveId(null)
    setPendingRemovals((prev) => new Set(prev).add(userId))
    try {
      await trpc.channels.removeMember.mutate({ channelId, userId })
    } catch (err: unknown) {
      setPendingRemovals((prev) => { const s = new Set(prev); s.delete(userId); return s })
      const msg = err instanceof Error ? err.message : String(err)
      setRemovalError(`Failed to remove ${userName}: ${msg}`)
    }
  }

  // Task names must be unique within a channel — the server enforces it with a
  // unique index, and this app's task URL IS the name ($taskName), so a duplicate
  // would make one of the two tasks unreachable. Checked here so the common case is
  // an inline message rather than a silently auto-suffixed name on sync.
  // Case-insensitive, matching the index's lower(name).
  const taskNameTaken = (tasks ?? []).some(
    (t) => t.name.trim().toLowerCase() === taskName.trim().toLowerCase(),
  )

  const handleAddTask = async (e: FormEvent) => {
    e.preventDefault()
    if (!session?.user || !channelId || !buildUnitId || !taskName.trim()) return
    if (taskNameTaken) return
    setIsSubmittingTask(true)
    try {
      createTaskAction({
        name: taskName.trim(),
        description: taskDesc.trim(),
        channel_id: channelId,
        buildunit_id: buildUnitId,
        createdby_id: session.user.id,
      })
      setTaskName("")
      setTaskDesc("")
    } finally {
      setIsSubmittingTask(false)
    }
  }

  const handleTaskClick = (taskId: string) => {
    const task = dbTasks?.find((t) => t.id === taskId)
    if (!task) return
    navigate({
      to: "/projects/$projectId/$buildUnitName/$channelName/$taskName",
      params: { projectId, buildUnitName, channelName, taskName: task.name },
    })
  }

  return {
    // Auth
    currentUserId: session?.user?.id ?? "",
    // Ownership
    isOwner,
    channelOwnerId,
    // Members
    channelMembers,
    nonMembers,
    isAddingMember,
    confirmRemoveId,
    setConfirmRemoveId,
    pendingRemovals,
    removalError,
    setRemovalError,
    alreadyMemberName,
    setAlreadyMemberName,
    // Tasks
    tasks,
    dbTasksReady: dbTasks !== undefined,
    taskName,
    setTaskName,
    taskNameTaken,
    taskDesc,
    setTaskDesc,
    isSubmittingTask,
    // Handlers
    handleAddMember,
    handleRemoveMember,
    handleAddTask,
    handleTaskClick,
  }
}
