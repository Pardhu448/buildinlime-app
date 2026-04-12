import { createFileRoute } from '@tanstack/react-router'
import { InboxPage } from '../../pages/InboxPage'
import { RoutePendingComponent } from '../../components/buildInlime'

export const Route = createFileRoute('/_authenticated/inbox')({
  component: InboxPage,
  pendingComponent: RoutePendingComponent,
})
