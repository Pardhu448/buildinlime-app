import type { Transaction } from "@tanstack/db"
import type { SeenScope } from "@buildinlime/domain-types"
import type { OfflineExecutor, OptimisticCollection } from "../platform"

// Advance a "last seen" marker for the current user. user_id is stamped
// server-side from the session — the client supplies only which view was seen. The
// user_id here is only for the optimistic local row's key. Upsert semantics:
// opening a view repeatedly pushes seen_at forward and never backward (mirrors the
// server's GREATEST()).
export type MarkSeenInput = {
  scope: SeenScope
  /** '' for the singleton inbox / mytasks scopes; the channel id for a channel. */
  scope_id: string
  /** The session user. Needed only for the optimistic local row's key. */
  user_id: string
}

type SeenInsertRow = {
  user_id: string
  scope: SeenScope
  scope_id: string
  seen_at: Date
}

export interface SeenActionsDeps {
  getExecutor: () => OfflineExecutor
  getCollection: () => OptimisticCollection<SeenInsertRow>
  /** App-specific composite key builder for the seen_state collection. */
  seenKey: (user_id: string, scope: string, scope_id: string) => string
}

export interface SeenActions {
  markSeenAction: (input: MarkSeenInput) => Transaction
  resetSeenActions: () => void
}

export function makeSeenActions(deps: SeenActionsDeps): SeenActions {
  const { getExecutor, getCollection, seenKey } = deps

  let _markSeen: ((v: MarkSeenInput) => Transaction) | null = null

  function markSeenFn() {
    if (_markSeen) return _markSeen
    _markSeen = getExecutor().createOfflineAction<MarkSeenInput>({
      mutationFnName: `markSeen`,
      onMutate: (v: MarkSeenInput) => {
        const key = seenKey(v.user_id, v.scope, v.scope_id)
        const now = new Date()
        const existing = getCollection().get(key)
        if (existing) {
          // Never move the line backward locally either — a stale replay must not
          // un-see newer activity.
          getCollection().update(key, (row: Record<string, unknown>) => {
            const prev = row.seen_at instanceof Date ? row.seen_at : new Date(row.seen_at as string)
            if (now > prev) row.seen_at = now
          })
        } else {
          getCollection().insert({
            user_id: v.user_id,
            scope: v.scope,
            scope_id: v.scope_id,
            seen_at: now,
          })
        }
      },
    })
    return _markSeen
  }

  return {
    markSeenAction: (input: MarkSeenInput): Transaction => markSeenFn()(input),
    resetSeenActions: (): void => {
      _markSeen = null
    },
  }
}
