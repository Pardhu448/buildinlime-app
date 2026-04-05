import { useLiveQuery, eq } from "@tanstack/react-db"
import { useProjectContext } from "@/src/application/context/ProjectContext"
import type { Property } from "@buildinlime/domain-types"

export function useProperties(entityId: string) {
  const { collections } = useProjectContext()
  const { data } = useLiveQuery(
    (q) =>
      q
        .from({ propertiesCollection: collections!.propertiesCollection })
        .where(({ propertiesCollection: p }) => eq(p.entity_id, entityId)),
    [collections, entityId]
  )
  return { properties: (data ?? []) as Property[] }
}
