import type { Transaction } from "@tanstack/db"
import { readsCollection, readKey } from "%/application/collections/communication"
import { getOfflineExecutor } from "%/infrastructure/offline/executor"

/**
 * Mark items read for the current user. `user_id` is stamped server-side from
 * the session (see the reads tRPC router) — the client supplies only what was
 * read, never whose read state it is.
 *
 * Takes a list because opening a channel marks every message in it read at once.
 */
export type MarkReadInput = {
  item_type: "message" | "task"
  item_ids: string[]
  channel_id: string
  /** The session user. Needed only for the optimistic local row's key. */
  user_id: string
}

let _markRead: ((v: MarkReadInput) => Transaction) | null = null

function markReadFn() {
  if (_markRead) return _markRead
  _markRead = getOfflineExecutor().createOfflineAction<MarkReadInput>({
    mutationFnName: `markRead`,
    onMutate: (v: MarkReadInput) => {
      for (const item_id of v.item_ids) {
        // Idempotent, mirroring the server's ON CONFLICT DO NOTHING. Marking read
        // is inherently repeatable — an effect can fire twice (React StrictMode
        // double-invokes them in dev), and the offline outbox replays a
        // transaction on retry. Inserting a key the collection already holds
        // throws "already exists in the collection", so skip instead.
        if (readsCollection.get(readKey(v.user_id, v.item_type, item_id))) continue
        readsCollection.insert({
          user_id: v.user_id,
          item_type: v.item_type,
          item_id,
          channel_id: v.channel_id,
          read_at: new Date(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
      }
    },
  })
  return _markRead
}

export const markReadAction = (input: MarkReadInput): Transaction =>
  markReadFn()!(input)

export function resetReadActions(): void {
  _markRead = null
}
