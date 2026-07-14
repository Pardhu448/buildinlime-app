import type { Transaction } from "@tanstack/db"
import { messagesCollection } from "%/application/collections/communication"
import { getOfflineExecutor } from "%/infrastructure/offline/executor"

export type CreateMessageInput = {
  id?: string
  text: string
  channel_id: string
  buildunit_id: string
  project_id: string
  createdby_id: string
  mention_ids?: string[]
  resource_ids?: string[]
  parent_id?: string | null
  /** Set only on a task status-change note — see Message.task_id. */
  task_id?: string | null
}

let _create: ((v: CreateMessageInput) => Transaction) | null = null

function createMessageFn() {
  if (_create) return _create
  _create = getOfflineExecutor().createOfflineAction<CreateMessageInput>({
    mutationFnName: `createMessage`,
    onMutate: (v: CreateMessageInput) => {
      messagesCollection.insert({
        id: v.id ?? crypto.randomUUID(),
        text: v.text,
        created_at: new Date(),
        channel_id: v.channel_id,
        buildunit_id: v.buildunit_id,
        project_id: v.project_id,
        createdby_id: v.createdby_id,
        mention_ids: v.mention_ids ?? [],
        resource_ids: v.resource_ids ?? [],
        parent_id: v.parent_id ?? null,
        task_id: v.task_id ?? null,
      })
    },
  })
  return _create
}

export type DeleteMessageInput = { id: string }

let _delete: ((v: DeleteMessageInput) => Transaction) | null = null

/**
 * Deleting a message is an UPDATE, not a removal — do not reach for
 * messagesCollection.delete().
 *
 * The row has to survive: replies hang off it via parent_id, so removing it would
 * orphan a whole thread. The server redacts it in place and the UI renders a
 * tombstone. Optimistically removing the row here would make the message vanish and
 * then POP BACK as a tombstone a moment later when the redacted row synced — so the
 * optimistic state mirrors the redaction instead.
 *
 * deleted_at is set locally only so the tombstone renders immediately; the server
 * stamps the authoritative value (a client may never assert it — see the insert
 * schemas, which omit it).
 */
function deleteMessageFn() {
  if (_delete) return _delete
  _delete = getOfflineExecutor().createOfflineAction<DeleteMessageInput>({
    mutationFnName: `deleteMessage`,
    onMutate: (v: DeleteMessageInput) => {
      messagesCollection.update(v.id, (m: Record<string, unknown>) => {
        m.text = ``
        m.mention_ids = []
        m.resource_ids = []
        m.deleted_at = new Date()
      })
    },
  })
  return _delete
}

export const createMessageAction = (input: CreateMessageInput): Transaction =>
  createMessageFn()!(input)
export const deleteMessageAction = (input: DeleteMessageInput): Transaction =>
  deleteMessageFn()!(input)

export function resetMessageActions(): void {
  _create = null
  _delete = null
}
