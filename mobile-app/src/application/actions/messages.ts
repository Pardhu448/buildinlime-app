import type { Transaction } from "@tanstack/db"
import * as Crypto from "expo-crypto"
import { messagesCollection } from "../collections/communication"
import { getOfflineExecutor } from "../../infrastructure/offline/executor"

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
}

let _create: ((v: CreateMessageInput) => Transaction) | null = null

function createMessageFn() {
  if (_create) return _create
  _create = getOfflineExecutor().createOfflineAction<CreateMessageInput>({
    mutationFnName: `createMessage`,
    onMutate: (v: CreateMessageInput) => {
      messagesCollection.insert({
        id: v.id ?? Crypto.randomUUID(),
        text: v.text,
        created_at: new Date(),
        channel_id: v.channel_id,
        buildunit_id: v.buildunit_id,
        project_id: v.project_id,
        createdby_id: v.createdby_id,
        mention_ids: v.mention_ids ?? [],
        resource_ids: v.resource_ids ?? [],
        parent_id: v.parent_id ?? null,
      })
    },
  })
  return _create
}

export const createMessageAction = (input: CreateMessageInput): Transaction =>
  createMessageFn()!(input)

export function resetMessageActions(): void {
  _create = null
}
