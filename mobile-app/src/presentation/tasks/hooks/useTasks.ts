import { useLiveQuery, eq } from "@tanstack/react-db"
import { tasksCollection } from "@/src/application/collections/communication"
import type { Task } from "@buildinlime/domain-types"

export function useTasks(assigneeId?: string) {
  const { data, isLoading } = useLiveQuery(
    (q) => {
      const base = q.from({ tasksCollection })
      return assigneeId
        ? base.where(({ tasksCollection: t }) => eq(t.assignee_id, assigneeId))
        : base
    },
    [assigneeId]
  )
  return { tasks: (data ?? []) as Task[], isLoading }
}
