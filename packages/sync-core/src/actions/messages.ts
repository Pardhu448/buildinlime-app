import type { Transaction } from "@tanstack/db"
import type { OfflineExecutor, OptimisticCollection } from "../platform"

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

export type DeleteMessageInput = { id: string }

type MessageInsertRow = {
  id: string
  text: string
  created_at: Date
  channel_id: string
  buildunit_id: string
  project_id: string
  createdby_id: string
  mention_ids: string[]
  resource_ids: string[]
  parent_id: string | null
  task_id: string | null
}

export interface MessageActionsDeps {
  randomUUID: () => string
  getExecutor: () => OfflineExecutor
  getCollection: () => OptimisticCollection<MessageInsertRow>
}

export interface MessageActions {
  createMessageAction: (input: CreateMessageInput) => Transaction
  deleteMessageAction: (input: DeleteMessageInput) => Transaction
  resetMessageActions: () => void
}

export function makeMessageActions(deps: MessageActionsDeps): MessageActions {
  const { randomUUID, getExecutor, getCollection } = deps

  let _create: ((v: CreateMessageInput) => Transaction) | null = null
  let _delete: ((v: DeleteMessageInput) => Transaction) | null = null

  function createFn() {
    if (_create) return _create
    _create = getExecutor().createOfflineAction<CreateMessageInput>({
      mutationFnName: `createMessage`,
      onMutate: (v: CreateMessageInput) => {
        getCollection().insert({
          id: v.id ?? randomUUID(),
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

  // Deleting a message is an UPDATE, not a removal — the row must survive because
  // replies hang off it via parent_id, so removing it would orphan a whole thread.
  // The server redacts it in place and the client renders a tombstone; the
  // optimistic state mirrors that redaction. deleted_at is set locally only so the
  // tombstone renders immediately (a client may never assert the authoritative
  // value — the insert schemas omit it).
  function deleteFn() {
    if (_delete) return _delete
    _delete = getExecutor().createOfflineAction<DeleteMessageInput>({
      mutationFnName: `deleteMessage`,
      onMutate: (v: DeleteMessageInput) => {
        getCollection().update(v.id, (m: Record<string, unknown>) => {
          m.text = ``
          m.mention_ids = []
          m.resource_ids = []
          m.deleted_at = new Date()
        })
      },
    })
    return _delete
  }

  return {
    createMessageAction: (input: CreateMessageInput): Transaction => createFn()(input),
    deleteMessageAction: (input: DeleteMessageInput): Transaction => deleteFn()(input),
    resetMessageActions: (): void => {
      _create = null
      _delete = null
    },
  }
}
