import { createFileRoute } from '@tanstack/react-router'
import { ChannelPage } from '../../../../../../pages/ChannelPage'
import { propertiesCollection, tasksCollection, resourcesCollection, messagesCollection } from '%/infrastructure/database/tanstack-db-electric/admincollections'
import { RoutePendingComponent } from '../../../../../../components/buildInlime'
import { useChannelRoute } from '../../../../../../hooks/use-channel-route'
import { useBuildUnitContext, useChannelContext } from '../../../../../../contexts/route-contexts'

export const Route = createFileRoute('/_authenticated/projects/$projectId/$buildUnitName/$channelName/')({
  component: ChannelRoute,
  loader: async () => {
    await Promise.all([propertiesCollection.preload(), tasksCollection.preload(), resourcesCollection.preload(), messagesCollection.preload()])
  },
  pendingComponent: RoutePendingComponent,
})

function ChannelRoute() {
  const { projectId, buildUnitName, channelName } = Route.useParams()
  const { buildUnitId, projectName } = useBuildUnitContext()
  const { channelId, channelDescription, channelIcon } = useChannelContext()
  const { properties, buildUnitProperties } = useChannelRoute(buildUnitId, channelId)

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
