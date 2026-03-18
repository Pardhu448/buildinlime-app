import { createFileRoute } from '@tanstack/react-router'
import { InboxPage } from '../../pages/InboxPage'
import { messagesCollection, channelsCollection } from '%/infrastructure/database/tanstack-db-electric/admincollections'
import { RoutePendingComponent } from '../../components/buildInlime'

export const Route = createFileRoute('/_authenticated/inbox')({
  component: InboxPage,
  loader: async () => {
    await Promise.all([
      messagesCollection.preload(),
      channelsCollection.preload(),
    ])
  },
  pendingComponent: RoutePendingComponent,
})
