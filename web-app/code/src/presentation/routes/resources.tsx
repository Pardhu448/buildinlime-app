import { createFileRoute } from '@tanstack/react-router'
import ResourcesPage from '../pages/ResourcesPage'

export const Route = createFileRoute('/resources')({
  head: () => ({
    meta: [{ title: 'Resources - BuildInLime' }],
  }),
  component: ResourcesPage,
})
