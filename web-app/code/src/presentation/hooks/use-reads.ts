import { useCallback, useMemo } from "react"
import { useLiveQuery } from "@tanstack/react-db"
import { useSession } from "%/infrastructure/auth/client"
import {
  readsCollection,
  messagesCollection,
} from "%/infrastructure/database/tanstack-db-electric/admincollections"
import { markReadAction } from "%/application/actions/reads"

/**
 * Unread state, derived by absence: an item is unread when there is no `reads`
 * row for it. Nothing to backfill for content that predates the feature — it
 * simply all starts unread.
 *
 * Scope note: this hook is consumed ONLY by route-level pages (InboxPage,
 * ChannelPage, TaskPage) — nothing always-mounted uses it anymore, now that the
 * Sidebar's per-channel unread pills are gone and the nav badges moved to
 * useInboxBadge / useMyTasksBadge. It subscribes to `reads` + the FULL `messages`
 * collection (markChannelMessagesRead needs every message in a channel to find
 * the unread ones), but because its only callers are pages, `messages` has no
 * always-mounted subscriber and is free to garbage-collect when no channel/inbox
 * view is open. It does NOT subscribe to `tasks` at all — the task read helpers
 * below need only the `reads` set, not the task rows.
 */
export function useReads() {
  const { data: session } = useSession()
  const userId = session?.user?.id ?? ""

  const { data: reads } = useLiveQuery((q) => q.from({ readsCollection }), [])
  const { data: allMessages } = useLiveQuery((q) => q.from({ messagesCollection }), [])

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

  const isTaskUnread = useCallback(
    (taskId: string) => !readTaskIds.has(taskId),
    [readTaskIds],
  )

  const isMessageUnread = useCallback(
    (messageId: string) => !readMessageIds.has(messageId),
    [readMessageIds],
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
    isTaskUnread,
    isMessageUnread,
    markChannelMessagesRead,
    markTaskRead,
    markMessageRead,
  }
}
