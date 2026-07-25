import { createFileRoute } from '@tanstack/react-router'
import { DeleteAccountPage } from '../../pages/DeleteAccountPage'
import { RoutePendingComponent } from '../../components/buildInlime'

export const Route = createFileRoute('/_authenticated/delete-account')({
  component: DeleteAccountPage,
  pendingComponent: RoutePendingComponent,
})
