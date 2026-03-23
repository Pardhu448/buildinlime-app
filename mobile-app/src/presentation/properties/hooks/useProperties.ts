import { useCollection } from "@tanstack/react-db"
import { useProjectContext } from "@/src/application/context/ProjectContext"
import type { Property } from "@buildinlime/domain-types"

export function useProperties(entityId: string) {
  const { collections } = useProjectContext()
  const { data } = useCollection(collections!.propertiesCollection, {
    select: (items) =>
      ([...items.values()] as Property[]).filter((p) => p.entity_id === entityId),
  })
  return { properties: data ?? [] }
}
