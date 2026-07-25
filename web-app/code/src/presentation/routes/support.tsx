import { createFileRoute } from '@tanstack/react-router'
import SupportPage from '../pages/SupportPage'

export const Route = createFileRoute('/support')({
  head: () => ({
    meta: [{ title: 'Support - BuildInLime' }],
  }),
  component: SupportPage,
})
