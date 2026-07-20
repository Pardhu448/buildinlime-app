import { createFileRoute } from '@tanstack/react-router'
import BlogPage from '../pages/BlogPage'

export const Route = createFileRoute('/blog')({
  head: () => ({
    meta: [{ title: 'Blog - BuildInLime' }],
  }),
  component: BlogPage,
})
