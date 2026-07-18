import { useLiveQuery, eq } from "@tanstack/react-db"
import { propertiesCollection } from '%/infrastructure/database/tanstack-db-electric/admincollections'
import { unwrapJsonb } from '%/presentation/lib/utils'
import type { Property } from '%/domain/communication/types'

// buildUnitId and channelId are pre-resolved by the layout routes via React context —
// no need to re-query projects, buildUnits, or channels here.
export function useChannelRoute(buildUnitId: string, channelId: string) {
  const { data: dbChannelProperties } = useLiveQuery(
    (q) => q.from({ propertiesCollection }).where(({ propertiesCollection: p }) => eq(p.entity_id, channelId)),
    [channelId]
  )

  const { data: dbBuildUnitProperties } = useLiveQuery(
    (q) => q.from({ propertiesCollection }).where(({ propertiesCollection: p }) => eq(p.entity_id, buildUnitId)),
    [buildUnitId]
  )

  const mapProperties = (rawList: typeof dbChannelProperties): Property[] =>
    (rawList ?? []).map((p) => ({
      ...p,
      type: unwrapJsonb(p.type),
      entity: unwrapJsonb(p.entity),
      status_value: unwrapJsonb(p.status_value),
      priority_value: unwrapJsonb(p.priority_value),
    }))

  return {
    properties: mapProperties(dbChannelProperties),
    buildUnitProperties: mapProperties(dbBuildUnitProperties),
  }
}
