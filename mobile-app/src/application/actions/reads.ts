import type { Transaction } from "@tanstack/db"
import { readsCollection, readKey } from "../collections/admin"
import { getOfflineExecutor } from "../../infrastructure/offline/executor"

/**
 * Mark items read for the current user. `user_id` is stamped server-side from the
 * session — the client says only WHAT was read, never whose read state it is.
 *
 * Takes a list because opening a channel marks every message in it read at once.
 */
export type MarkReadInput = {
  item_type: "message" | "task"
  item_ids: string[]
  channel_id: string
  /** The session user — needed only to build the optimistic row's key. */
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
        // is inherently repeatable — re-opening a channel re-marks it, and the
        // outbox replays on retry — and inserting a key the collection already
        // holds throws "already exists in the collection".
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
