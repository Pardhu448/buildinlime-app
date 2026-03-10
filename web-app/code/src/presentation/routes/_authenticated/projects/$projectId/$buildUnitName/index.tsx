import { createFileRoute } from '@tanstack/react-router'
import { useLiveQuery, eq } from "@tanstack/react-db"
import { ClipboardCheck } from 'lucide-react'
import { BuildUnitPage } from '../../../../../pages/BuildUnitPage'
import { buildUnitsCollection, channelsCollection, propertiesCollection, projectsCollection } from '%/infrastructure/database/tanstack-db-electric/admincollections'
import { CHANNEL_NAMES } from '%/infrastructure/database/schema/admin-schema'
import { CHANNEL_ICONS } from '%/presentation/lib/channelIcons'
import { unwrapJsonb } from '%/presentation/lib/utils'
import { RoutePendingComponent } from '../../../../../components/buildInlime/RoutePendingComponent'
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

  // Fetch properties for this specific build unit.
  // entity is a jsonb column — Electric SQL returns it as '"buildUnit"' (JSON-encoded).
  // Filtering on it with eq() would never match after sync, so filter only on entity_id (text).
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
    return (
      <div className="flex h-screen items-center justify-center text-[#717182]">
        Build unit "{buildUnitName}" not found.
      </div>
    )
  }

  // --- Render ---

  const projectName = dbProjects?.[0]?.name ?? 'Project'
  const buildUnitDesc = buildUnit.description ?? ''

  // Transform database channels to Channel type with icons
  // channel.name is a jsonb column — ElectricSQL may return it as a JSON-encoded string (e.g. '"Finance"')
  // or as a plain string ('Finance') depending on shape version; handle both.
  const channels: Channel[] = (dbChannels ?? []).map((channel) => {
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

  const properties: Property[] = (dbProperties ?? []).map((p) => ({
    ...p,
    type: unwrapJsonb(p.type) as Property['type'],
    entity: unwrapJsonb(p.entity) as Property['entity'],
    status_value: unwrapJsonb(p.status_value) as Property['status_value'],
    priority_value: unwrapJsonb(p.priority_value) as Property['priority_value'],
  }))

  return <BuildUnitPage projectId={projectId} buildUnitName={buildUnitName} buildUnitId={buildUnitId} projectName={projectName} buildUnitDesc={buildUnitDesc} channels={channels} properties={properties} />
}
