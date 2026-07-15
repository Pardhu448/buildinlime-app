import { useCallback, useMemo } from "react"
import { useLiveQuery } from "@tanstack/react-db"
import { useSession } from "%/infrastructure/auth/client"
import { seenStateCollection } from "%/infrastructure/database/tanstack-db-electric/admincollections"
import { markSeenAction } from "%/application/actions/seen"

/**
 * "Seen" state, timestamp model (successor to useReads). An item is unseen when
 * it arrived AFTER the last time you looked at the view it belongs to — not
 * tracked per-item. Opening a view marks everything currently in it seen; the
 * marks fire on leave (see the pages' unmount effects).
 *
 *   - inbox   → one timestamp; a mention is unseen if created_at > inboxSeenAt
 *   - mytasks → one timestamp; a task is unseen if opened_at > mytasksSeenAt
 *   - channel → one timestamp per channel; a task is unseen if opened_at >
 *               channelSeenAt(channel_id)
 *
 * No membership scope — seen_state is `user_id = me`, so this reads one small
 * always-loaded collection.
 */
const EPOCH = new Date(0)
const toDate = (v: unknown): Date => (v instanceof Date ? v : new Date(v as string))

export function useSeen() {
  const { data: session } = useSession()
  const userId = session?.user?.id ?? ""

  const { data: seenRows } = useLiveQuery((q) => q.from({ seenStateCollection }), [])

  const seenMap = useMemo(() => {
    const m = new Map<string, Date>()
    for (const r of seenRows ?? []) m.set(`${r.scope}:${r.scope_id}`, toDate(r.seen_at))
    return m
  }, [seenRows])

  const inboxSeenAt = seenMap.get("inbox:") ?? EPOCH
  const mytasksSeenAt = seenMap.get("mytasks:") ?? EPOCH
  const channelSeenAt = useCallback(
    (channelId: string) => seenMap.get(`channel:${channelId}`) ?? EPOCH,
    [seenMap],
  )

  /** An inbox mention is unseen if it arrived after you last opened the Inbox. */
  const isMessageUnseen = useCallback(
    (createdAt: Date | string) => toDate(createdAt) > inboxSeenAt,
    [inboxSeenAt],
  )

  /** A task is unseen if it was created after you last opened its channel. */
  const isTaskUnseen = useCallback(
    (task: { opened_at: Date | string; channel_id: string }) =>
      toDate(task.opened_at) > channelSeenAt(task.channel_id),
    [channelSeenAt],
  )

  const markInboxSeen = useCallback(() => {
    if (userId) markSeenAction({ scope: "inbox", scope_id: "", user_id: userId })
  }, [userId])
  const markMyTasksSeen = useCallback(() => {
    if (userId) markSeenAction({ scope: "mytasks", scope_id: "", user_id: userId })
  }, [userId])
  const markChannelSeen = useCallback(
    (channelId: string) => {
      if (userId) markSeenAction({ scope: "channel", scope_id: channelId, user_id: userId })
    },
    [userId],
  )

  return {
    inboxSeenAt,
    mytasksSeenAt,
    channelSeenAt,
    isMessageUnseen,
    isTaskUnseen,
    markInboxSeen,
    markMyTasksSeen,
    markChannelSeen,
  }
}
