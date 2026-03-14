import { createFileRoute } from '@tanstack/react-router'
import { useLiveQuery, eq } from "@tanstack/react-db"
import { useState, useEffect } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { ChannelPage } from '../../../../../../pages/ChannelPage'
import { projectsCollection, buildUnitsCollection, channelsCollection, propertiesCollection, tasksCollection, resourcesCollection, messagesCollection } from '%/infrastructure/database/tanstack-db-electric/admincollections'
import { CHANNEL_NAMES } from '%/infrastructure/database/schema/admin-schema'
import { CHANNEL_ICONS } from '%/presentation/lib/channelIcons'
import { unwrapJsonb } from '%/presentation/lib/utils'
import { RoutePendingComponent } from '../../../../../../components/buildInlime/RoutePendingComponent'
import type { Property } from '%/infrastructure/database/schema/admin-schema'

export const Route = createFileRoute('/_authenticated/projects/$projectId/$buildUnitName/$channelName/')({
  component: ChannelRoute,
  loader: async () => {
    await Promise.all([channelsCollection.preload(), propertiesCollection.preload(), tasksCollection.preload(), resourcesCollection.preload(), messagesCollection.preload()])
  },
  pendingComponent: RoutePendingComponent,
})

function ChannelRoute() {
  const { projectId, buildUnitName, channelName } = Route.useParams()
  const [syncTimedOut, setSyncTimedOut] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSyncTimedOut(true), 5000)
    return () => clearTimeout(t)
  }, [])

  // Look up the project name by projectId
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

  // Find the channel matching channelName within this build unit
  const { data: dbChannels } = useLiveQuery(
    (q) =>
      q
        .from({ channelsCollection })
        .where(({ channelsCollection: c }) => eq(c.buildunit_id, buildUnitId)),
    [buildUnitId]
  )

  const channel = (dbChannels ?? []).find((c) => {
    const raw = c.name as unknown as string
    const name = raw.startsWith('"') ? JSON.parse(raw) : raw
    return name === channelName
  })

  const channelId = channel?.id ?? ''

  // Fetch properties scoped to this channel
  const { data: dbChannelProperties } = useLiveQuery(
    (q) =>
      q
        .from({ propertiesCollection })
        .where(({ propertiesCollection: p }) => eq(p.entity_id, channelId)),
    [channelId]
  )

  // Fetch properties scoped to the build unit
  const { data: dbBuildUnitProperties } = useLiveQuery(
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

  if (dbChannels === undefined) {
    return <div className="flex h-screen items-center justify-center text-[#717182]">Loading…</div>
  }

  if (!channel) {
    if (!syncTimedOut) {
      return <div className="flex h-screen items-center justify-center text-[#717182]">Loading…</div>
    }
    return (
      <div className="flex h-screen items-center justify-center text-[#717182]">
        Channel "{channelName}" not found.
      </div>
    )
  }

  // --- Render ---

  const projectName = dbProjects?.[0]?.name ?? "Project"
  const channelDescription = channel.description ?? ''
  const channelIcon = CHANNEL_ICONS[channelName as typeof CHANNEL_NAMES[number]] ?? ClipboardCheck

  const mapProperties = (raw_list: typeof dbChannelProperties): Property[] =>
    (raw_list ?? []).map((p) => ({
      ...p,
      type: unwrapJsonb(p.type) as Property['type'],
      entity: unwrapJsonb(p.entity) as Property['entity'],
      status_value: unwrapJsonb(p.status_value) as Property['status_value'],
      priority_value: unwrapJsonb(p.priority_value) as Property['priority_value'],
    }))

  const properties = mapProperties(dbChannelProperties)
  const buildUnitProperties = mapProperties(dbBuildUnitProperties)

  return (
    <ChannelPage
      projectId={projectId}
      projectName={projectName}
      buildUnitName={buildUnitName}
      buildUnitId={buildUnitId}
      channelName={channelName}
      channelId={channelId}
      icon={channelIcon}
      title={channelName}
      description={channelDescription}
      properties={properties}
      buildUnitProperties={buildUnitProperties}
    />
  )
}
