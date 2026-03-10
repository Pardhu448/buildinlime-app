import { createFileRoute } from '@tanstack/react-router'
import { MyTasksPage } from '../../pages/MyTasksPage'
import { tasksCollection, channelsCollection } from '%/infrastructure/database/tanstack-db-electric/admincollections'
import { RoutePendingComponent } from '../../components/buildInlime/RoutePendingComponent'

export const Route = createFileRoute('/_authenticated/my-tasks')({
  component: MyTasksPage,
  loader: async () => {
    await Promise.all([
      tasksCollection.preload(),
      channelsCollection.preload(),
    ])
  },
  pendingComponent: RoutePendingComponent,
})
