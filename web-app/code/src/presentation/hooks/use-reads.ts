import { useCallback, useMemo } from "react"
import { useLiveQuery } from "@tanstack/react-db"
import { useSession } from "%/infrastructure/auth/client"
import {
  readsCollection,
  messagesCollection,
  tasksCollection,
} from "%/infrastructure/database/tanstack-db-electric/admincollections"
import { markReadAction } from "%/application/actions/reads"
import { parseTextArray } from "%/presentation/lib/utils"

/**
 * Unread state, derived by absence: an item is unread when there is no `reads`
 * row for it. Nothing to backfill for content that predates the feature — it
 * simply all starts unread.
 */
export function useReads() {
  const { data: session } = useSession()
  const userId = session?.user?.id ?? ""

  const { data: reads } = useLiveQuery((q) => q.from({ readsCollection }), [])
  const { data: allMessages } = useLiveQuery((q) => q.from({ messagesCollection }), [])
  const { data: allTasks } = useLiveQuery((q) => q.from({ tasksCollection }), [])

  // The shape only ever contains this user's rows, but key by item so lookups
  // are O(1) rather than a scan per message.
  const readMessageIds = useMemo(
    () =>
      new Set(
        (reads ?? [])
          .filter((r) => r.item_type === "message")
          .map((r) => r.item_id),
      ),
    [reads],
  )
  const readTaskIds = useMemo(
    () =>
      new Set(
        (reads ?? []).filter((r) => r.item_type === "task").map((r) => r.item_id),
      ),
    [reads],
  )

  /** Unread messages in a channel — excluding your own, which you have by definition read. */
  const unreadMessageCount = useCallback(
    (channelId: string) =>
      (allMessages ?? []).filter(
        (m) =>
          m.channel_id === channelId &&
          m.createdby_id !== userId &&
          !readMessageIds.has(m.id),
      ).length,
    [allMessages, readMessageIds, userId],
  )

  /** Tasks in a channel you have not opened yet — excluding ones you created. */
  const unopenedTaskCount = useCallback(
    (channelId: string) =>
      (allTasks ?? []).filter(
        (t) =>
          t.channel_id === channelId &&
          t.createdby_id !== userId &&
          !readTaskIds.has(t.id),
      ).length,
    [allTasks, readTaskIds, userId],
  )

  const isTaskUnread = useCallback(
    (taskId: string) => !readTaskIds.has(taskId),
    [readTaskIds],
  )

  const isMessageUnread = useCallback(
    (messageId: string) => !readMessageIds.has(messageId),
    [readMessageIds],
  )

  /**
   * Tasks assigned to me that I have not opened — the My Tasks badge.
   * Scoped to my own tasks, not the whole channel: "My Tasks" means mine.
   */
  const myUnopenedTaskCount = useMemo(
    () =>
      (allTasks ?? []).filter(
        (t) =>
          t.assignee_id === userId &&
          !t.completed &&
          !readTaskIds.has(t.id),
      ).length,
    [allTasks, readTaskIds, userId],
  )

  /**
   * Messages that mention me and that I have not read — the Inbox badge.
   * mention_ids arrives from Electric as a `{a,b}` array literal, hence
   * parseTextArray rather than a plain includes().
   */
  const unreadMentionCount = useMemo(
    () =>
      (allMessages ?? []).filter(
        (m) =>
          parseTextArray(m.mention_ids).includes(userId) &&
          m.createdby_id !== userId &&
          !readMessageIds.has(m.id),
      ).length,
    [allMessages, readMessageIds, userId],
  )

  /**
   * Mark every message currently in a channel read. Bulk, not per-message:
   * nobody clicks each message, so a click-only rule would peg the badge at
   * hundreds forever. Already-read ids are filtered out so re-opening a channel
   * is a no-op rather than a pointless write.
   */
  const markChannelMessagesRead = useCallback(
    (channelId: string) => {
      if (!userId) return
      const unread = (allMessages ?? [])
        .filter(
          (m) =>
            m.channel_id === channelId &&
            m.createdby_id !== userId &&
            !readMessageIds.has(m.id),
        )
        .map((m) => m.id)
      if (unread.length === 0) return
      markReadAction({
        item_type: "message",
        item_ids: unread,
        channel_id: channelId,
        user_id: userId,
      })
    },
    [allMessages, readMessageIds, userId],
  )

  /** Mark one task read — tasks ARE opened individually, so this is per-click. */
  const markTaskRead = useCallback(
    (taskId: string, channelId: string) => {
      if (!userId || readTaskIds.has(taskId)) return
      markReadAction({
        item_type: "task",
        item_ids: [taskId],
        channel_id: channelId,
        user_id: userId,
      })
    },
    [readTaskIds, userId],
  )

  /** Mark a single message read — used by the Inbox deep-link. */
  const markMessageRead = useCallback(
    (messageId: string, channelId: string) => {
      if (!userId || readMessageIds.has(messageId)) return
      markReadAction({
        item_type: "message",
        item_ids: [messageId],
        channel_id: channelId,
        user_id: userId,
      })
    },
    [readMessageIds, userId],
  )

  return {
    unreadMessageCount,
    unopenedTaskCount,
    myUnopenedTaskCount,
    unreadMentionCount,
    isTaskUnread,
    isMessageUnread,
    markChannelMessagesRead,
    markTaskRead,
    markMessageRead,
  }
}
