import { createFileRoute } from '@tanstack/react-router'
import { ChannelPage } from '../../../../../../pages/ChannelPage'
import { RoutePendingComponent } from '../../../../../../components/buildInlime'
import { useChannelRoute } from '../../../../../../hooks/use-channel-route'
import { useBuildUnitContext, useChannelContext } from '../../../../../../contexts/route-contexts'

export const Route = createFileRoute('/_authenticated/projects/$projectId/$buildUnitName/$channelName/')({
  component: ChannelRoute,
  pendingComponent: RoutePendingComponent,
  // ?messageId= — set by the Inbox so a mention lands ON the message rather than
  // at the top of the channel, leaving you to hunt for what you just clicked.
  validateSearch: (search: Record<string, unknown>): { messageId?: string } => ({
    messageId: typeof search.messageId === 'string' ? search.messageId : undefined,
  }),
})

function ChannelRoute() {
  const { projectId, buildUnitName, channelName } = Route.useParams()
  const { messageId } = Route.useSearch()
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
      focusMessageId={messageId}
    />
  )
}
