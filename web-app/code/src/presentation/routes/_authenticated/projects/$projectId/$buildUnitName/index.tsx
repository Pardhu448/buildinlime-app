import { createFileRoute } from '@tanstack/react-router'
import { BuildUnitPage } from '../../../../../pages/BuildUnitPage'
import { RoutePendingComponent } from '../../../../../components/buildInlime'
import { useBuildUnitChannels } from '../../../../../hooks/use-build-unit-channels'
import { useBuildUnitContext } from '../../../../../contexts/route-contexts'

export const Route = createFileRoute('/_authenticated/projects/$projectId/$buildUnitName/')({
  component: BuildUnitIndexRoute,
  pendingComponent: RoutePendingComponent,
})

function BuildUnitIndexRoute() {
  const { projectId, buildUnitName } = Route.useParams()
  const { buildUnitId, buildUnitDesc, projectName } = useBuildUnitContext()
  const result = useBuildUnitChannels(buildUnitId, projectId, buildUnitName)

  if (result.status === 'loading') {
    return <div className="flex h-screen items-center justify-center text-muted-foreground">Loading…</div>
  }

  const { channels, properties, pendingChannelIds, addPending, removePending, onChannelTrpcComplete, deleteChannel } = result

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
      deleteChannel={deleteChannel}
    />
  )
}
