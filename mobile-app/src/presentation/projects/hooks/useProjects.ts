import { useLiveQuery } from "@tanstack/react-db"
import { projectsCollection } from "@/src/application/collections/projects"

export interface Project {
  id: string
  name: string
  description?: string | null
  owner_id: string
  created_at?: string | Date
  updated_at?: string | Date
}

export function useProjects() {
  const { data } = useLiveQuery(
    (q) => q.from({ projectsCollection }),
    []
  )

  // data is undefined while the Electric sync hasn't completed yet
  return {
    projects: data as Project[] | undefined,
    isLoading: data === undefined,
  }
}
