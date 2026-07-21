import { useEffect, useCallback, useRef } from 'react'
import { useLiveQuery, eq, inArray } from "@tanstack/react-db"
import { ClipboardCheck } from 'lucide-react'
import { channelsCollection, propertiesCollection } from '%/infrastructure/database/tanstack-db-electric/admincollections'
import { useSession } from '%/infrastructure/auth/client'
import type { CHANNEL_NAMES } from '%/domain/shared/types'
import { CHANNEL_ICONS } from '%/presentation/lib/channelIcons'
import { unwrapJsonb, mapPropertyRow } from '%/presentation/lib/utils'
import { usePendingItems } from './use-pending-items'
import type { Channel } from '../components/buildInlime'
import type { Property } from '%/domain/communication/types'

export type BuildUnitChannelsStatus = 'loading' | 'ready'

// buildUnitId is pre-resolved by the $buildUnitName layout route via BuildUnitContext —
// no need to re-query buildUnitsCollection or projectsCollection here.
export function useBuildUnitChannels(buildUnitId: string, projectId: string, buildUnitName: string) {
  const { data: session } = useSession()
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

  // Live properties for every channel in this build unit, so each channel card
  // can show its own property indicators (parity with the build unit above).
  const channelIds = (dbChannels ?? []).map((c) => c.id)
  const { data: dbChannelProperties } = useLiveQuery(
    (q) => q.from({ propertiesCollection }).where(({ propertiesCollection: p }) => inArray(p.entity_id, channelIds)),
    [channelIds.join(`,`)]
  )

  if (dbChannels === undefined) return { status: 'loading' as const }

  const channelPropsByEntity = new Map<string, Property[]>()
  for (const p of dbChannelProperties ?? []) {
    const property = mapPropertyRow(p)
    const list = channelPropsByEntity.get(property.entity_id) ?? []
    list.push(property)
    channelPropsByEntity.set(property.entity_id, list)
  }

  const dbChannelList: Channel[] = (dbChannels ?? []).map((channel) => {
    // Type argument rather than a trailing cast: CHANNEL_ICONS is keyed by the
    // channel-name union, so `string` cannot index it.
    const name = unwrapJsonb<typeof CHANNEL_NAMES[number]>(channel.name)
    return {
      id: channel.id,
      title: name,
      description: channel.description ?? '',
      icon: CHANNEL_ICONS[name] ?? ClipboardCheck,
      linkParams: { projectId, buildUnitName, channelName: name },
      properties: channelPropsByEntity.get(channel.id) ?? [],
      // Owner-only delete — server-enforced (channels.delete); the button is courtesy.
      canDelete: !!session?.user && channel.owner_id === session.user.id,
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
      linkParams: undefined,
      properties: [],
      // A ghost channel is still reconciling its create — never offer to delete it.
      canDelete: false,
    }))

  const channels = [...dbChannelList, ...ghostChannels]

  const properties: Property[] = (dbProperties ?? []).map(mapPropertyRow)

  // Soft delete, owner-only. The channel and its tasks/resources fall out of their
  // Electric shapes — the server cascades the soft-delete (channels.delete). The
  // collection.delete triggers onDelete → trpc.channels.delete. Confirmation is the
  // page's job (ConfirmDeleteModal); this is the raw action run once confirmed.
  const deleteChannel = (id: string) => {
    channelsCollection.delete(id)
  }

  return {
    status: 'ready' as const,
    channels,
    properties,
    pendingChannelIds,
    addPending,
    removePending,
    onChannelTrpcComplete,
    deleteChannel,
  }
}
