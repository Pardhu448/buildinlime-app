import { useEffect, useMemo, useRef } from "react"
import { FlatList, View, StyleSheet } from "react-native"
import { useLiveQuery, eq } from "@tanstack/react-db"
import { MessageItem } from "./MessageItem"
import { resourcesCollection } from "@/src/application/collections/communication"
import { useChannelMessageUploads } from "@/src/presentation/resources/hooks/usePendingUploads"
import { colors } from "@/src/presentation/shared/colors"
import type { PendingUpload } from "@/src/infrastructure/offline/upload-manager"
import type { Message, Resource } from "@buildinlime/domain-types"

interface MessageListProps {
  channelId: string
  messages: Message[]
  currentUserId: string
  usersMap: Record<string, string>
  onReply?: (message: Message) => void
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

function toMs(d: Date | string | undefined): number {
  if (!d) return 0
  const t = (typeof d === "string" ? new Date(d) : d).getTime()
  return isNaN(t) ? 0 : t
}

/**
 * A threaded comment tree, matching web's CommentsSection: top-level messages
 * newest-first, each with its replies nested beneath it. A flat transcript makes
 * concurrent conversations impossible to follow — the tree is what separates them.
 */
export function MessageList({
  channelId,
  messages,
  currentUserId,
  usersMap,
  onReply,
}: MessageListProps) {
  // Synced resources for this channel, and the still-uploading attachments —
  // both grouped by message id so each row can render its own attachments.
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

  // Replies indexed by the message they answer, each thread in the order it was
  // written (oldest first) — a conversation reads downwards.
  const repliesByParent = useMemo(() => {
    const map = groupBy(messages, (m) => m.parent_id)
    for (const list of map.values()) {
      list.sort((a, b) => toMs(a.created_at) - toMs(b.created_at))
    }
    return map
  }, [messages])

  // Thread roots, newest conversation first (web sorts the same way). A reply to
  // an old thread does NOT resurface it — the thread keeps its original place,
  // so the list doesn't reshuffle under the reader.
  const threadRoots = useMemo(
    () =>
      messages
        .filter((m) => !m.parent_id)
        .sort((a, b) => toMs(b.created_at) - toMs(a.created_at)),
    [messages]
  )

  // Jump to the newest thread when the user starts one. Replies are deliberately
  // excluded: a reply lands inside a thread that is already on screen, so
  // scrolling away from it would lose the user's place.
  const listRef = useRef<FlatList<Message>>(null)
  const newestRoot = threadRoots[0]
  const lastOwnRootId = useRef<string | null>(null)

  useEffect(() => {
    if (!newestRoot || newestRoot.createdby_id !== currentUserId) return
    if (lastOwnRootId.current === newestRoot.id) return
    lastOwnRootId.current = newestRoot.id
    listRef.current?.scrollToOffset({ offset: 0, animated: true })
  }, [newestRoot, currentUserId])

  return (
    <FlatList
      ref={listRef}
      data={threadRoots}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <MessageItem
          message={item}
          repliesByParent={repliesByParent}
          usersMap={usersMap}
          resourcesByMessage={resourcesByMessage}
          uploadsByMessage={uploadsByMessage}
          currentUserId={currentUserId}
          onReply={onReply}
        />
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  separator: {
    height: 1,
    backgroundColor: colors.cardBorder,
  },
})
