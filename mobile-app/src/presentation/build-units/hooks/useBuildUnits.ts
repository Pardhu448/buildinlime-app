import { useCollection } from "@tanstack/react-db"
import { useProjectContext } from "@/src/application/context/ProjectContext"
import type { BuildUnit } from "@buildinlime/domain-types"

export function useBuildUnits() {
  const { collections } = useProjectContext()
  const { data, isLoading } = useCollection(collections!.buildUnitsCollection, {
    select: (items) => [...items.values()] as BuildUnit[],
  })
  return { buildUnits: data ?? [], isLoading }
}
