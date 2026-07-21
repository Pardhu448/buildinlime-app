import { createFileRoute } from '@tanstack/react-router'
import AboutPage from '../pages/AboutPage'

export const Route = createFileRoute('/about')({
  head: () => ({
    meta: [{ title: 'About - BuildInLime' }],
  }),
  component: AboutPage,
})
