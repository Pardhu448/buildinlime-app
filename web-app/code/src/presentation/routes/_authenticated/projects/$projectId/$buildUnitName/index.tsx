import { createFileRoute } from '@tanstack/react-router'
import { useLiveQuery, eq } from "@tanstack/react-db"
import { useState, useEffect, useCallback, useRef } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { BuildUnitPage } from '../../../../../pages/BuildUnitPage'
import { buildUnitsCollection, channelsCollection, propertiesCollection, projectsCollection } from '%/infrastructure/database/tanstack-db-electric/admincollections'
import { CHANNEL_NAMES } from '%/infrastructure/database/schema/admin-schema'
import { CHANNEL_ICONS } from '%/presentation/lib/channelIcons'
import { unwrapJsonb } from '%/presentation/lib/utils'
import { RoutePendingComponent } from '../../../../../components/buildInlime/RoutePendingComponent'
import { usePendingItems } from '../../../../../hooks/use-pending-items'
import type { Channel } from '../../../../../components/buildInlime'
import type { Property } from '%/infrastructure/database/schema/admin-schema'

export const Route = createFileRoute('/_authenticated/projects/$projectId/$buildUnitName/')({
  component: BuildUnitIndexRoute,
  loader: async () => {
    await Promise.all([channelsCollection.preload(), propertiesCollection.preload()])
  },
  pendingComponent: RoutePendingComponent,
})

function BuildUnitIndexRoute() {
  const { projectId, buildUnitName } = Route.useParams()
  const [syncTimedOut, setSyncTimedOut] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSyncTimedOut(true), 5000)
    return () => clearTimeout(t)
  }, [])

  // Pending channels state + two-signal logic (same pattern as build units)
  const { pendingItems: pendingChannels, pendingIds: pendingChannelIds, addPending, removePending } = usePendingItems()
  const pendingChannelIdsRef = useRef(pendingChannelIds)
  pendingChannelIdsRef.current = pendingChannelIds
  const channelTrpcDoneRef = useRef<Set<string>>(new Set())

  const onChannelTrpcComplete = useCallback((id: string) => {
    channelTrpcDoneRef.current.add(id)
  }, [])

  // Look up project name
  const { data: dbProjects } = useLiveQuery(
    (q) =>
      q
        .from({ projectsCollection })
        .where(({ projectsCollection: p }) => eq(p.id, projectId)),
    [projectId]
  )

  // Look up the build unit by projectId + buildUnitName to get its id
  const { data: dbBuildUnits } = useLiveQuery(
    (q) =>
      q
        .from({ buildUnitsCollection })
        .where(({ buildUnitsCollection: bu }) => eq(bu.project_id, projectId)),
    [projectId]
  )

  const buildUnit = (dbBuildUnits ?? []).find((bu) => bu.name === buildUnitName)
  const buildUnitId = buildUnit?.id ?? ''

  // Fetch channels for this specific build unit
  const { data: dbChannels } = useLiveQuery(
    (q) =>
      q
        .from({ channelsCollection })
        .where(({ channelsCollection: bu }) => eq(bu.buildunit_id, buildUnitId)),
    [buildUnitId]
  )

  // Second signal: Electric updated dbChannels + tRPC done → stop spinner
  useEffect(() => {
    if (!dbChannels) return
    for (const id of pendingChannelIdsRef.current) {
      if (channelTrpcDoneRef.current.has(id) && dbChannels.some((c) => c.id === id)) {
        removePending(id)
        channelTrpcDoneRef.current.delete(id)
      }
    }
  }, [dbChannels])

  // Fetch properties for this specific build unit.
  const { data: dbProperties } = useLiveQuery(
    (q) =>
      q
        .from({ propertiesCollection })
        .where(({ propertiesCollection: p }) => eq(p.entity_id, buildUnitId)),
    [buildUnitId]
  )

  // --- Existence guards (after all hooks) ---

  if (dbBuildUnits === undefined) {
    return <div className="flex h-screen items-center justify-center text-[#717182]">Loading…</div>
  }

  if (!buildUnit) {
    if (!syncTimedOut) {
      return <div className="flex h-screen items-center justify-center text-[#717182]">Loading…</div>
    }
    return (
      <div className="flex h-screen items-center justify-center text-[#717182]">
        Build unit "{buildUnitName}" not found.
      </div>
    )
  }

  // --- Render ---

  const projectName = dbProjects?.[0]?.name ?? 'Project'
  const buildUnitDesc = buildUnit.description ?? ''

  const dbChannelList: Channel[] = (dbChannels ?? []).map((channel) => {
    const raw = channel.name as unknown as string
    const name: typeof CHANNEL_NAMES[number] = raw.startsWith('"') ? JSON.parse(raw) : raw as typeof CHANNEL_NAMES[number]
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

  return (
    <BuildUnitPage
      projectId={projectId}
      buildUnitName={buildUnitName}
      buildUnitId={buildUnitId}
      projectName={projectName}
      buildUnitDesc={buildUnitDesc}
      channels={channels}
      properties={properties}
      pendingChannelIds={pendingChannelIds}
      addPendingChannel={addPending}
      removePendingChannel={removePending}
      onChannelTrpcComplete={onChannelTrpcComplete}
    />
  )
}
