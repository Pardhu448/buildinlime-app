import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useLiveQuery, eq } from '@tanstack/react-db'
import { ClipboardCheck } from 'lucide-react'
import { channelsCollection } from '%/infrastructure/database/tanstack-db-electric/admincollections'
import type { CHANNEL_NAMES } from '%/domain/shared/types'
import { CHANNEL_ICONS } from '%/presentation/lib/channelIcons'
import { unwrapJsonb } from '%/presentation/lib/utils'
import { useBuildUnitContext, ChannelContextProvider } from '../../../../../contexts/route-contexts'

export const Route = createFileRoute('/_authenticated/projects/$projectId/$buildUnitName/$channelName')({
  component: ChannelLayout,
})

function ChannelLayout() {
  const { channelName } = Route.useParams()
  const { buildUnitId } = useBuildUnitContext()
  const [syncTimedOut, setSyncTimedOut] = useState(false)

  useEffect(() => {
    setSyncTimedOut(false)
    const t = setTimeout(() => setSyncTimedOut(true), 5000)
    return () => clearTimeout(t)
  }, [buildUnitId, channelName])

  const { data: dbChannels } = useLiveQuery(
    (q) => q.from({ channelsCollection }).where(({ channelsCollection: c }) => eq(c.buildunit_id, buildUnitId)),
    [buildUnitId]
  )

  if (dbChannels === undefined) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground">Loading…</div>
  }

  const channel = dbChannels.find((c) => {
    const name = unwrapJsonb(c.name as unknown as string)
    return name === channelName
  })

  if (!channel) {
    if (!syncTimedOut) {
      return <div className="flex h-screen items-center justify-center text-muted-foreground">Loading…</div>
    }
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Channel "{channelName}" not found.
      </div>
    )
  }

  return (
    <ChannelContextProvider value={{
      channelId: channel.id,
      channelDescription: channel.description ?? '',
      channelIcon: CHANNEL_ICONS[channelName as typeof CHANNEL_NAMES[number]] ?? ClipboardCheck,
    }}>
      <Outlet />
    </ChannelContextProvider>
  )
}
