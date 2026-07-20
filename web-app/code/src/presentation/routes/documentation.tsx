import { createFileRoute } from '@tanstack/react-router'
import DocumentationPage from '../pages/DocumentationPage'

export const Route = createFileRoute('/documentation')({
  head: () => ({
    meta: [{ title: 'Documentation - BuildInLime' }],
  }),
  component: DocumentationPage,
})
