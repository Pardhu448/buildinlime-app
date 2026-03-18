import { useEffect, useCallback, useRef } from 'react'
import { useLiveQuery, eq } from "@tanstack/react-db"
import { ClipboardCheck } from 'lucide-react'
import { channelsCollection, propertiesCollection } from '%/infrastructure/database/tanstack-db-electric/admincollections'
import { CHANNEL_NAMES } from '%/domain/shared/types'
import { CHANNEL_ICONS } from '%/presentation/lib/channelIcons'
import { unwrapJsonb } from '%/presentation/lib/utils'
import { usePendingItems } from './use-pending-items'
import type { Channel } from '../components/buildInlime'
import type { Property } from '%/domain/communication/types'

export type BuildUnitChannelsStatus = 'loading' | 'ready'

// buildUnitId is pre-resolved by the $buildUnitName layout route via BuildUnitContext —
// no need to re-query buildUnitsCollection or projectsCollection here.
export function useBuildUnitChannels(buildUnitId: string, projectId: string, buildUnitName: string) {
  const { pendingItems: pendingChannels, pendingIds: pendingChannelIds, addPending, removePending } = usePendingItems()
  const pendingChannelIdsRef = useRef(pendingChannelIds)
  pendingChannelIdsRef.current = pendingChannelIds
  const channelTrpcDoneRef = useRef<Set<string>>(new Set())

  const onChannelTrpcComplete = useCallback((id: string) => {
    channelTrpcDoneRef.current.add(id)
  }, [])

  const { data: dbChannels } = useLiveQuery(
    (q) => q.from({ channelsCollection }).where(({ channelsCollection: c }) => eq(c.buildunit_id, buildUnitId)),
    [buildUnitId]
  )

  // Two-signal: stop spinner only when both tRPC is done AND Electric confirms the write
  useEffect(() => {
    if (!dbChannels) return
    for (const id of pendingChannelIdsRef.current) {
      if (channelTrpcDoneRef.current.has(id) && dbChannels.some((c) => c.id === id)) {
        removePending(id)
        channelTrpcDoneRef.current.delete(id)
      }
    }
  }, [dbChannels])

  const { data: dbProperties } = useLiveQuery(
    (q) => q.from({ propertiesCollection }).where(({ propertiesCollection: p }) => eq(p.entity_id, buildUnitId)),
    [buildUnitId]
  )

  if (dbChannels === undefined) return { status: 'loading' as const }

  const dbChannelList: Channel[] = (dbChannels ?? []).map((channel) => {
    const name = unwrapJsonb(channel.name as unknown as string) as typeof CHANNEL_NAMES[number]
    return {
      id: channel.id,
      title: name,
      description: channel.description ?? '',
      icon: CHANNEL_ICONS[name] ?? ClipboardCheck,
      to: `/projects/${projectId}/${buildUnitName}/${name}`,
    }
  })

  // Ghost rows: keep pending channels visible during Electric txid reconciliation
  const dbChannelIds = new Set(dbChannelList.map((c) => c.id))
  const ghostChannels: Channel[] = [...pendingChannels.values()]
    .filter((p) => !dbChannelIds.has(p.id))
    .map((p) => ({
      id: p.id,
      title: p.name as typeof CHANNEL_NAMES[number],
      description: p.description ?? '',
      icon: CHANNEL_ICONS[p.name as typeof CHANNEL_NAMES[number]] ?? ClipboardCheck,
      to: undefined,
    }))

  const channels = [...dbChannelList, ...ghostChannels]

  const properties: Property[] = (dbProperties ?? []).map((p) => ({
    ...p,
    type: unwrapJsonb(p.type) as Property['type'],
    entity: unwrapJsonb(p.entity) as Property['entity'],
    status_value: unwrapJsonb(p.status_value) as Property['status_value'],
    priority_value: unwrapJsonb(p.priority_value) as Property['priority_value'],
  }))

  return {
    status: 'ready' as const,
    channels,
    properties,
    pendingChannelIds,
    addPending,
    removePending,
    onChannelTrpcComplete,
  }
}
