import { useMemo } from "react"
import { useLiveQuery } from "@tanstack/react-db"
import { useSession } from "%/infrastructure/auth/client"
import {
  readsCollection,
  inboxMentionsCollection,
} from "%/infrastructure/database/tanstack-db-electric/admincollections"

/**
 * The Sidebar inbox badge: how many messages that mention me are unread.
 *
 * Reads the user-scoped `inbox-mentions` slice, NOT the full `messages`
 * collection — that is the whole point. The slice is already filtered
 * server-side to `mention_ids @> [me]` (see routes/api/inbox-mentions.ts), so the
 * always-mounted badge no longer pins every channel's messages open for the
 * session just to count a handful. Unread is still derived by absence of a
 * `reads` row, exactly as before.
 */
export function useInboxBadge() {
  const { data: session } = useSession()
  const userId = session?.user?.id ?? ""

  const { data: reads } = useLiveQuery((q) => q.from({ readsCollection }), [])
  const { data: mentions } = useLiveQuery(
    (q) => q.from({ inboxMentionsCollection }),
    [],
  )

  const readMessageIds = useMemo(
    () =>
      new Set(
        (reads ?? [])
          .filter((r) => r.item_type === "message")
          .map((r) => r.item_id),
      ),
    [reads],
  )

  // The slice already guarantees these mention me; we only drop my own messages
  // (a self-mention is not an inbox item) and ones I have already read.
  const unreadMentionCount = useMemo(
    () =>
      (mentions ?? []).filter(
        (m) => m.createdby_id !== userId && !readMessageIds.has(m.id),
      ).length,
    [mentions, readMessageIds, userId],
  )

  return { unreadMentionCount }
}
