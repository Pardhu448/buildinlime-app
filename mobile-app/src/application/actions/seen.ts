import type { Transaction } from "@tanstack/db"
import { seenStateCollection, seenKey } from "../collections/admin"
import { getOfflineExecutor } from "../../infrastructure/offline/executor"

/**
 * Advance a "last seen" marker for the current user (the timestamp successor to
 * markRead). `user_id` is stamped server-side from the session — the client
 * supplies only which view was seen, never whose seen-state it is. The `user_id`
 * here is only for the optimistic local row's key.
 *
 * Upsert semantics: opening a view repeatedly just pushes seen_at forward, so
 * this updates an existing row in place rather than inserting a duplicate, and
 * never moves the line backward (mirrors the server's GREATEST()).
 */
export type MarkSeenInput = {
  scope: "inbox" | "mytasks" | "channel"
  /** '' for the singleton inbox / mytasks scopes; the channel id for a channel. */
  scope_id: string
  /** The session user. Needed only for the optimistic local row's key. */
  user_id: string
}

let _markSeen: ((v: MarkSeenInput) => Transaction) | null = null

function markSeenFn() {
  if (_markSeen) return _markSeen
  _markSeen = getOfflineExecutor().createOfflineAction<MarkSeenInput>({
    mutationFnName: `markSeen`,
    onMutate: (v: MarkSeenInput) => {
      const key = seenKey(v.user_id, v.scope, v.scope_id)
      const now = new Date()
      const existing = seenStateCollection.get(key)
      if (existing) {
        // Never move the line backward locally either — a stale replay must not
        // un-see newer activity.
        seenStateCollection.update(key, (row: Record<string, unknown>) => {
          const prev = row.seen_at instanceof Date ? row.seen_at : new Date(row.seen_at as string)
          if (now > prev) row.seen_at = now
        })
      } else {
        seenStateCollection.insert({
          user_id: v.user_id,
          scope: v.scope,
          scope_id: v.scope_id,
          seen_at: now,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
      }
    },
  })
  return _markSeen
}

export const markSeenAction = (input: MarkSeenInput): Transaction =>
  markSeenFn()!(input)

export function resetSeenActions(): void {
  _markSeen = null
}
