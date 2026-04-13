import { useLiveQuery, eq } from "@tanstack/react-db"
import { buildUnitsCollection } from "@/src/application/collections/organization"

export function useBuildUnits(projectId?: string) {
  const { data, isLoading } = useLiveQuery(
    (q) => {
      const base = q.from({ buildUnitsCollection })
      return projectId
        ? base.where(({ buildUnitsCollection: b }) => eq(b.project_id, projectId))
        : base
    },
    [projectId]
  )
  return { buildUnits: data ?? [], isLoading }
}
