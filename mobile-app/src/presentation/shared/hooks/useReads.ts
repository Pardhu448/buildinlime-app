import { useCallback, useMemo } from "react"
import { useLiveQuery } from "@tanstack/react-db"
import { readsCollection } from "@/src/application/collections/admin"
import {
  messagesCollection,
  tasksCollection,
} from "@/src/application/collections/communication"
import { markReadAction } from "@/src/application/actions/reads"
import { useSession } from "@/src/infrastructure/auth/client"
import type { Message, Task } from "@buildinlime/domain-types"

/**
 * Unread state, derived by ABSENCE: an item is unread when it has no `reads` row.
 * Nothing to backfill for content that predates the feature — it all starts unread.
 *
 * Mirrors web's use-reads.ts; keep the two in step.
 *
 * Only mount under a selected project: messages/tasks are project-scoped and are
 * null until initProjectCollections runs (reads itself is a bootstrap collection).
 */
export function useReads() {
  const { data: session } = useSession()
  const userId = session?.user?.id ?? ""

  const { data: reads } = useLiveQuery((q) => q.from({ readsCollection }), [])
  const { data: allMessages } = useLiveQuery((q) => q.from({ messagesCollection }), [])
  const { data: allTasks } = useLiveQuery((q) => q.from({ tasksCollection }), [])

  const readMessageIds = useMemo(
    () =>
      new Set(
        (reads ?? [])
          .filter((r) => r.item_type === "message")
          .map((r) => r.item_id as string),
      ),
    [reads],
  )
  const readTaskIds = useMemo(
    () =>
      new Set(
        (reads ?? [])
          .filter((r) => r.item_type === "task")
          .map((r) => r.item_id as string),
      ),
    [reads],
  )

  /**
   * Tasks assigned to me, not completed, that I have not opened — the My Tasks
   * badge. Scoped to my own tasks, not the whole project: "My Tasks" means mine.
   */
  const myUnopenedTaskCount = useMemo(
    () =>
      ((allTasks ?? []) as Task[]).filter(
        (t) => t.assignee_id === userId && !t.completed && !readTaskIds.has(t.id),
      ).length,
    [allTasks, readTaskIds, userId],
  )

  /** Messages mentioning me that I have not read — the Inbox badge. */
  const unreadMentionCount = useMemo(
    () =>
      ((allMessages ?? []) as Message[]).filter(
        (m) =>
          Array.isArray(m.mention_ids) &&
          m.mention_ids.includes(userId) &&
          m.createdby_id !== userId &&
          !readMessageIds.has(m.id),
      ).length,
    [allMessages, readMessageIds, userId],
  )

  const isMessageUnread = useCallback(
    (messageId: string) => !readMessageIds.has(messageId),
    [readMessageIds],
  )
  const isTaskUnread = useCallback(
    (taskId: string) => !readTaskIds.has(taskId),
    [readTaskIds],
  )

  /**
   * Mark every message in a channel read, in one call. Bulk rather than per-tap:
   * nobody taps each message, so a tap-only rule would peg the badge at hundreds
   * forever and it could never reach zero. Already-read ids are filtered out, so
   * re-opening a channel is a no-op rather than a pointless write.
   */
  const markChannelMessagesRead = useCallback(
    (channelId: string) => {
      if (!userId) return
      const unread = ((allMessages ?? []) as Message[])
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

  /** Tasks ARE opened one at a time, so this is per-tap. */
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
    myUnopenedTaskCount,
    unreadMentionCount,
    isMessageUnread,
    isTaskUnread,
    markChannelMessagesRead,
    markTaskRead,
    markMessageRead,
  }
}
