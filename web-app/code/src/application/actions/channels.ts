import type { Transaction } from "@tanstack/db"
import { channelsCollection } from "%/application/collections/organization"
import { getOfflineExecutor } from "%/infrastructure/offline/executor"
import type { ChannelName } from "%/infrastructure/database/schema/admin-schema"

export type CreateChannelInput = {
  id: string
  name: ChannelName
  description: string
  buildunit_id: string
  owner_id: string
}

export type UpdateChannelInput = {
  id: string
  patch: {
    name?: ChannelName
    description?: string | null
  }
}

export type DeleteChannelInput = { id: string }

let _create: ((v: CreateChannelInput) => Transaction) | null = null
let _update: ((v: UpdateChannelInput) => Transaction) | null = null
let _delete: ((v: DeleteChannelInput) => Transaction) | null = null

function createChannelFn() {
  if (_create) return _create
  _create = getOfflineExecutor().createOfflineAction<CreateChannelInput>({
    mutationFnName: `createChannel`,
    onMutate: (v: CreateChannelInput) => {
      channelsCollection.insert({
        id: v.id,
        name: v.name,
        description: v.description,
        buildunit_id: v.buildunit_id,
        owner_id: v.owner_id,
        created_at: new Date(),
      })
    },
  })
  return _create
}

function updateChannelFn() {
  if (_update) return _update
  _update = getOfflineExecutor().createOfflineAction<UpdateChannelInput>({
    mutationFnName: `updateChannel`,
    onMutate: (v: UpdateChannelInput) => {
      channelsCollection.update(v.id, (c: Record<string, unknown>) => {
        if (v.patch.name !== undefined) c.name = v.patch.name
        if (v.patch.description !== undefined) c.description = v.patch.description
      })
    },
  })
  return _update
}

function deleteChannelFn() {
  if (_delete) return _delete
  _delete = getOfflineExecutor().createOfflineAction<DeleteChannelInput>({
    mutationFnName: `deleteChannel`,
    onMutate: (v: DeleteChannelInput) => {
      channelsCollection.delete(v.id)
    },
  })
  return _delete
}

export const createChannelAction = (input: CreateChannelInput): Transaction =>
  createChannelFn()!(input)
export const updateChannelAction = (input: UpdateChannelInput): Transaction =>
  updateChannelFn()!(input)
export const deleteChannelAction = (input: DeleteChannelInput): Transaction =>
  deleteChannelFn()!(input)

export function resetChannelActions(): void {
  _create = null
  _update = null
  _delete = null
}
