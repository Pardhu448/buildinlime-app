import { useLiveQuery, eq } from "@tanstack/react-db"
import { useProjectContext } from "@/src/application/context/ProjectContext"
import type { Task } from "@buildinlime/domain-types"

export function useTasks(assigneeId?: string) {
  const { collections } = useProjectContext()
  const { data, isLoading } = useLiveQuery(
    (q) => {
      const base = q.from({ tasksCollection: collections!.tasksCollection })
      return assigneeId
        ? base.where(({ tasksCollection: t }) => eq(t.assignee_id, assigneeId))
        : base
    },
    [collections, assigneeId]
  )
  return { tasks: (data ?? []) as Task[], isLoading }
}
