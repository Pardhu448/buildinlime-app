import { createFileRoute } from '@tanstack/react-router'
import ContactPage from '../pages/ContactPage'

export const Route = createFileRoute('/contact')({
  head: () => ({
    meta: [{ title: 'Contact - BuildInLime' }],
  }),
  component: ContactPage,
})
