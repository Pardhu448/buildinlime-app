import { useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "@tanstack/react-db"
import { useSession } from "%/infrastructure/auth/client"
import {
  messagesCollection,
  usersCollection,
  channelsCollection,
  buildUnitsCollection,
  projectsCollection,
} from "%/infrastructure/database/tanstack-db-electric/admincollections"
import { unwrapJsonb, parseTextArray } from "%/presentation/lib/utils"
import { formatDateTime } from "%/presentation/lib/datetime"

export function useInboxPage() {
  const { data: session } = useSession()
  const navigate = useNavigate()
  const currentUserId = session?.user?.id ?? ""

  const { data: allMessages } = useLiveQuery((q) => q.from({ messagesCollection }), [])
  const { data: allUsers } = useLiveQuery((q) => q.from({ usersCollection }), [])
  const { data: allChannels } = useLiveQuery((q) => q.from({ channelsCollection }), [])
  const { data: allBuildUnits } = useLiveQuery((q) => q.from({ buildUnitsCollection }), [])
  const { data: allProjects } = useLiveQuery((q) => q.from({ projectsCollection }), [])

  const getChannel = (channelId: string) => (allChannels ?? []).find((c) => c.id === channelId)
  const getBuildUnit = (buildunitId: string) => (allBuildUnits ?? []).find((b) => b.id === buildunitId)
  const getProject = (projectId: string) => (allProjects ?? []).find((p) => p.id === projectId)

  const getUserName = (userId: string) => {
    const user = (allUsers ?? []).find((u) => u.id === userId)
    return user?.name || user?.email || "Unknown"
  }

  const mentionedMessages = (allMessages ?? [])
    .filter((m) => parseTextArray(m.mention_ids).includes(currentUserId))
    .sort((a, b) => {
      const aTime = a.created_at instanceof Date ? a.created_at.getTime() : new Date(a.created_at as string).getTime()
      const bTime = b.created_at instanceof Date ? b.created_at.getTime() : new Date(b.created_at as string).getTime()
      return bTime - aTime
    })

  const formatTime = (val: unknown) => formatDateTime(val as Date | string)

  const handleMessageClick = (msg: NonNullable<typeof allMessages>[number]) => {
    const buildUnit = getBuildUnit(msg.buildunit_id)
    const channel = getChannel(msg.channel_id)
    if (!buildUnit || !channel) return
    // Bound before the call: inferring through the params union picks `undefined`
    // for the generic rather than its `string` default.
    const channelName = unwrapJsonb(channel.name)
    navigate({
      to: "/projects/$projectId/$buildUnitName/$channelName",
      params: {
        projectId: msg.project_id,
        buildUnitName: buildUnit.name,
        channelName,
      },
      // Carry the message id so the channel can scroll to it. Without this the
      // Inbox only ever landed you at the top of the channel, leaving you to
      // hunt for the message you just clicked.
      search: { messageId: msg.id },
    })
  }

  return {
    currentUserId,
    mentionedMessages,
    getUserName,
    getChannel,
    getBuildUnit,
    getProject,
    formatTime,
    handleMessageClick,
  }
}
