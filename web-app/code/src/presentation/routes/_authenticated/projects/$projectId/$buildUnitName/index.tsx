import { createFileRoute } from '@tanstack/react-router'
import { BuildUnitPage } from '../../../../../pages/BuildUnitPage'
import { channelsCollection, propertiesCollection } from '%/infrastructure/database/tanstack-db-electric/admincollections'
import { RoutePendingComponent } from '../../../../../components/buildInlime'
import { useBuildUnitChannels } from '../../../../../hooks/use-build-unit-channels'
import { useBuildUnitContext } from '../../../../../contexts/route-contexts'

export const Route = createFileRoute('/_authenticated/projects/$projectId/$buildUnitName/')({
  component: BuildUnitIndexRoute,
  loader: async () => {
    await Promise.all([channelsCollection.preload(), propertiesCollection.preload()])
  },
  pendingComponent: RoutePendingComponent,
})

function BuildUnitIndexRoute() {
  const { projectId, buildUnitName } = Route.useParams()
  const { buildUnitId, buildUnitDesc, projectName } = useBuildUnitContext()
  const result = useBuildUnitChannels(buildUnitId, projectId, buildUnitName)

  if (result.status === 'loading') {
    return <div className="flex h-screen items-center justify-center text-[#717182]">Loading…</div>
  }

  const { channels, properties, pendingChannelIds, addPending, removePending, onChannelTrpcComplete } = result

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
