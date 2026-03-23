import { useLiveQuery } from "@tanstack/react-db"
import { useProjectContext } from "@/src/application/context/ProjectContext"

export function useBuildUnits() {
  const { collections } = useProjectContext()
  const { data, isLoading } = useLiveQuery(
    (q) => q.from({ buildUnitsCollection: collections!.buildUnitsCollection }),
    [collections]
  )
  return { buildUnits: data ?? [], isLoading }
}
