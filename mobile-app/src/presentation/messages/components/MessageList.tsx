import { useEffect, useMemo, useRef, useState } from "react"
import { FlatList, View, StyleSheet } from "react-native"
import { useLiveQuery, eq } from "@tanstack/react-db"
import { MessageItem } from "./MessageItem"
import { resourcesCollection } from "@/src/application/collections/communication"
import { useChannelMessageUploads } from "@/src/presentation/resources/hooks/usePendingUploads"
import { confirmSynced } from "@/src/infrastructure/offline/upload-manager"
import { colors } from "@/src/presentation/shared/colors"
import type { Message, Resource } from "@buildinlime/domain-types"

interface MessageListProps {
  channelId: string
  messages: Message[]
  currentUserId: string
  usersMap: Record<string, string>
  onReply?: (message: Message) => void
  /** ?messageId= from the Inbox — scroll to and briefly highlight this message. */
  focusMessageId?: string
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
  focusMessageId,
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

  // Once a resource has synced, retire its optimistic upload stand-in (same id):
  // the manager kept the local file on screen to bridge the Electric replay gap,
  // and this is the signal that the synced row has taken over. A no-op for every
  // id that isn't a `synced` pending upload, so it's safe to run over them all.
  useEffect(() => {
    for (const r of (resourceData ?? []) as Resource[]) void confirmSynced(r.id)
  }, [resourceData])
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

  // Arriving from the Inbox: scroll to the message that was tapped and flash it.
  //
  // The list's data is threadRoots, so a mentioned REPLY has no row of its own —
  // scroll to the thread it lives in (its parent) and highlight the reply inside.
  //
  // Keyed on threadRoots, not just mount: on a cold open the messages collection is
  // still syncing when this first runs, the message is not in the list yet, and a
  // one-shot scroll would silently do nothing. The ref makes it fire once per id
  // rather than on every message that arrives afterwards.
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const scrolledToId = useRef<string | null>(null)

  useEffect(() => {
    if (!focusMessageId) return
    if (scrolledToId.current === focusMessageId) return

    const target = messages.find((m) => m.id === focusMessageId)
    if (!target) return // not synced yet — try again when messages change

    const rootId = target.parent_id ?? target.id
    const index = threadRoots.findIndex((m) => m.id === rootId)
    if (index < 0) return

    scrolledToId.current = focusMessageId
    // Rows are variable-height and there is no getItemLayout, so this can miss —
    // onScrollToIndexFailed below is the fallback, not an optional nicety.
    listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.2 })
    setHighlightId(focusMessageId)
    const timer = setTimeout(() => setHighlightId(null), 2000)
    return () => clearTimeout(timer)
  }, [focusMessageId, messages, threadRoots])

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
          highlightId={highlightId}
        />
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      style={styles.list}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      // Rows are variable-height and getItemLayout would be a lie, so FlatList can
      // fail to reach an index it has not measured yet. Nudge to the best estimate,
      // let it render, then land the jump exactly.
      onScrollToIndexFailed={({ index, averageItemLength }) => {
        listRef.current?.scrollToOffset({
          offset: index * averageItemLength,
          animated: true,
        })
        setTimeout(() => {
          listRef.current?.scrollToIndex({
            index,
            animated: true,
            viewPosition: 0.2,
          })
        }, 300)
      }}
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
