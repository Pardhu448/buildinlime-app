import { createFileRoute } from '@tanstack/react-router'
import { MyTasksPage } from '../../pages/MyTasksPage'
import { RoutePendingComponent } from '../../components/buildInlime'

export const Route = createFileRoute('/_authenticated/my-tasks')({
  component: MyTasksPage,
  pendingComponent: RoutePendingComponent,
})
