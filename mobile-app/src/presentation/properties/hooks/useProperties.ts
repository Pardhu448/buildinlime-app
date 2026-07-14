import { useMemo } from "react"
import { useLiveQuery, eq } from "@tanstack/react-db"
import { propertiesCollection } from "@/src/application/collections/communication"
import type { EntityType, Property } from "@buildinlime/domain-types"

// Every property of one entity type, grouped by the entity it belongs to — so a
// list of cards can each render their own pills off a single query.
export function usePropertiesByEntity(entity: EntityType) {
  const { data } = useLiveQuery(
    (q) =>
      q
        .from({ propertiesCollection })
        .where(({ propertiesCollection: p }) => eq(p.entity, entity)),
    [entity]
  )

  return useMemo(() => {
    const byEntityId = new Map<string, Property[]>()
    for (const p of (data ?? []) as Property[]) {
      const list = byEntityId.get(p.entity_id)
      if (list) list.push(p)
      else byEntityId.set(p.entity_id, [p])
    }
    return byEntityId
  }, [data])
}
