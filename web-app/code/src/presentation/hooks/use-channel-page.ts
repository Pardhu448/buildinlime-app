import { useState } from "react"
import type { FormEvent } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useLiveQuery, eq } from "@tanstack/react-db"
import { tasksCollection, channelsCollection, usersCollection, membershipsCollection } from "%/infrastructure/database/tanstack-db-electric/admincollections"
import { trpc } from "%/infrastructure/trpc/lib/trpc-client"
import { useSession } from "%/infrastructure/auth/client"
import type { Task } from "../components/buildInlime"

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
    (q) => q.from({ membershipsCollection }).where(({ membershipsCollection: m }) => eq(m.channel_id, channelId)),
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

  const tasks: Task[] = (dbTasks ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    completed: t.completed,
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

  const handleAddTask = async (e: FormEvent) => {
    e.preventDefault()
    if (!session?.user || !channelId || !buildUnitId || !taskName.trim()) return
    setIsSubmittingTask(true)
    try {
      await tasksCollection.insert({
        id: crypto.randomUUID(),
        name: taskName.trim(),
        description: taskDesc.trim(),
        completed: false,
        opened_at: new Date(),
        closed_at: new Date(),
        channel_id: channelId,
        buildunit_id: buildUnitId,
        createdby_id: session.user.id,
        assignee_id: null,
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
