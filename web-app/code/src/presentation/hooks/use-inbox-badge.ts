import { useMemo } from "react"
import { useLiveQuery } from "@tanstack/react-db"
import { useSession } from "%/infrastructure/auth/client"
import { inboxMentionsCollection } from "%/infrastructure/database/tanstack-db-electric/admincollections"
import { useSeen } from "%/presentation/hooks/use-seen"

/**
 * The Sidebar inbox badge: how many messages that mention me arrived since I last
 * opened the Inbox.
 *
 * Reads the user-scoped `inbox-mentions` slice + a single `inbox` seen timestamp
 * (not the full messages collection, and no per-item reads). A mention is unseen
 * iff created_at > inboxSeenAt; opening the Inbox pushes that timestamp forward
 * (on leave), clearing the badge.
 */
export function useInboxBadge() {
  const { data: session } = useSession()
  const userId = session?.user?.id ?? ""
  const { inboxSeenAt } = useSeen()

  const { data: mentions } = useLiveQuery(
    (q) => q.from({ inboxMentionsCollection }),
    [],
  )

  const unreadMentionCount = useMemo(
    () =>
      (mentions ?? []).filter(
        (m) =>
          m.createdby_id !== userId &&
          new Date(m.created_at as string | Date) > inboxSeenAt,
      ).length,
    [mentions, inboxSeenAt, userId],
  )

  return { unreadMentionCount }
}
