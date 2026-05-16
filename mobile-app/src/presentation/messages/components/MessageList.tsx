import { useMemo } from "react"
import { FlatList, StyleSheet } from "react-native"
import { useLiveQuery, eq } from "@tanstack/react-db"
import { MessageBubble } from "./MessageBubble"
import { resourcesCollection } from "@/src/application/collections/communication"
import { useChannelMessageUploads } from "@/src/presentation/resources/hooks/usePendingUploads"
import type { PendingUpload } from "@/src/infrastructure/offline/upload-manager"
import type { Message, Resource } from "@buildinlime/domain-types"

interface MessageListProps {
  channelId: string
  messages: Message[]
  currentUserId: string
  usersMap: Record<string, string>
}

function groupBy<T>(items: T[], key: (item: T) => string | null | undefined) {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const k = key(item)
    if (!k) continue
    const arr = map.get(k)
    if (arr) arr.push(item)
    else map.set(k, [item])
  }
  return map
}

export function MessageList({
  channelId,
  messages,
  currentUserId,
  usersMap,
}: MessageListProps) {
  // Synced resources for this channel, and the still-uploading attachments —
  // both grouped by message id so each bubble can render its own attachments.
  const { data: resourceData } = useLiveQuery(
    (q) =>
      q
        .from({ resourcesCollection })
        .where(({ resourcesCollection: r }) => eq(r.channel_id, channelId)),
    [channelId]
  )
  const messageUploads = useChannelMessageUploads(channelId)

  const resourcesByMessage = useMemo(
    () => groupBy((resourceData ?? []) as Resource[], (r) => r.message_id),
    [resourceData]
  )
  const uploadsByMessage = useMemo(
    () => groupBy(messageUploads, (u) => u.messageId),
    [messageUploads]
  )

  // Reverse for inverted FlatList (newest at bottom)
  const reversed = [...messages].reverse()
  const EMPTY_RESOURCES: Resource[] = []
  const EMPTY_UPLOADS: PendingUpload[] = []

  return (
    <FlatList
      data={reversed}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <MessageBubble
          message={item}
          senderName={usersMap[item.createdby_id] ?? "Unknown"}
          isOwn={item.createdby_id === currentUserId}
          attachments={resourcesByMessage.get(item.id) ?? EMPTY_RESOURCES}
          pendingAttachments={uploadsByMessage.get(item.id) ?? EMPTY_UPLOADS}
        />
      )}
      inverted
      style={styles.list}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    />
  )
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  content: {
    paddingVertical: 12,
  },
})
