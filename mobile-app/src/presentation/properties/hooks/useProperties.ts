import { useLiveQuery, eq } from "@tanstack/react-db"
import { propertiesCollection } from "@/src/application/collections/communication"
import type { Property } from "@buildinlime/domain-types"

export function useProperties(entityId: string) {
  const { data } = useLiveQuery(
    (q) =>
      q
        .from({ propertiesCollection })
        .where(({ propertiesCollection: p }) => eq(p.entity_id, entityId)),
    [entityId]
  )
  return { properties: (data ?? []) as Property[] }
}
