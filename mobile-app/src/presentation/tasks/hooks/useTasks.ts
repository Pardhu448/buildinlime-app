import { useCollection } from "@tanstack/react-db"
import { useProjectContext } from "@/src/application/context/ProjectContext"
import type { Task } from "@buildinlime/domain-types"

export function useTasks(assigneeId?: string) {
  const { collections } = useProjectContext()
  const { data, isLoading } = useCollection(collections!.tasksCollection, {
    select: (items) => {
      const all = [...items.values()] as Task[]
      return assigneeId ? all.filter((t) => t.assignee_id === assigneeId) : all
    },
  })
  return { tasks: data ?? [], isLoading }
}
