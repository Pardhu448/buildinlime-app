import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/projects/$projectId/$buildUnitName/$channelName')({
  component: () => <Outlet />,
})
