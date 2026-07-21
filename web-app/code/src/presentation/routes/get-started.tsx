import { createFileRoute } from '@tanstack/react-router'
import GettingStartedPage from '../pages/GettingStartedPage'

export const Route = createFileRoute('/get-started')({
  head: () => ({
    meta: [{ title: 'Getting Started - BuildInLime' }],
  }),
  component: GettingStartedPage,
})
