import { useLiveQuery } from "@tanstack/react-db"
import { projectsCollection } from "@/src/application/collections/projects"

export function useProjects() {
  const { data, isLoading } = useLiveQuery((q) => q.from({ projectsCollection }), [])
  return { projects: data ?? [], isLoading }
}
