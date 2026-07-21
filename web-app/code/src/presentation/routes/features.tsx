import { createFileRoute } from '@tanstack/react-router'
import FeaturesPage from '../pages/FeaturesPage'

export const Route = createFileRoute('/features')({
  head: () => ({
    meta: [{ title: 'Features - BuildInLime' }],
  }),
  component: FeaturesPage,
})
