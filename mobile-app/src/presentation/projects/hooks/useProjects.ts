import { useCollection } from "@tanstack/react-db"
import { projectsCollection } from "@/src/application/collections/projects"
import type { Project } from "@buildinlime/domain-types"

export function useProjects() {
  const { data, isLoading } = useCollection(projectsCollection, {
    select: (items) => [...items.values()] as Project[],
  })
  return { projects: data ?? [], isLoading }
}
