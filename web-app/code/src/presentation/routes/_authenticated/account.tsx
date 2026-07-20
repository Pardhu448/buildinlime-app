import { createFileRoute } from '@tanstack/react-router'
import { AccountPage } from '../../pages/AccountPage'
import { RoutePendingComponent } from '../../components/buildInlime'

export const Route = createFileRoute('/_authenticated/account')({
  component: AccountPage,
  pendingComponent: RoutePendingComponent,
})
