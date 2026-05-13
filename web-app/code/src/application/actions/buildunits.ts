import type { Transaction } from "@tanstack/db"
import { buildUnitsCollection } from "%/application/collections/organization"
import { getOfflineExecutor } from "%/infrastructure/offline/executor"

export type CreateBuildUnitInput = {
  id: string
  name: string
  description: string
  project_id: string
  owner_id: string
}

export type UpdateBuildUnitInput = {
  id: string
  patch: {
    name?: string
    description?: string | null
  }
}

export type DeleteBuildUnitInput = { id: string }

let _create: ((v: CreateBuildUnitInput) => Transaction) | null = null
let _update: ((v: UpdateBuildUnitInput) => Transaction) | null = null
let _delete: ((v: DeleteBuildUnitInput) => Transaction) | null = null

function createBuildUnitFn() {
  if (_create) return _create
  _create = getOfflineExecutor().createOfflineAction<CreateBuildUnitInput>({
    mutationFnName: `createBuildUnit`,
    onMutate: (v: CreateBuildUnitInput) => {
      buildUnitsCollection.insert({
        id: v.id,
        name: v.name,
        description: v.description,
        project_id: v.project_id,
        owner_id: v.owner_id,
        created_at: new Date(),
      })
    },
  })
  return _create
}

function updateBuildUnitFn() {
  if (_update) return _update
  _update = getOfflineExecutor().createOfflineAction<UpdateBuildUnitInput>({
    mutationFnName: `updateBuildUnit`,
    onMutate: (v: UpdateBuildUnitInput) => {
      buildUnitsCollection.update(v.id, (b: Record<string, unknown>) => {
        if (v.patch.name !== undefined) b.name = v.patch.name
        if (v.patch.description !== undefined) b.description = v.patch.description
      })
    },
  })
  return _update
}

function deleteBuildUnitFn() {
  if (_delete) return _delete
  _delete = getOfflineExecutor().createOfflineAction<DeleteBuildUnitInput>({
    mutationFnName: `deleteBuildUnit`,
    onMutate: (v: DeleteBuildUnitInput) => {
      buildUnitsCollection.delete(v.id)
    },
  })
  return _delete
}

export const createBuildUnitAction = (input: CreateBuildUnitInput): Transaction =>
  createBuildUnitFn()!(input)
export const updateBuildUnitAction = (input: UpdateBuildUnitInput): Transaction =>
  updateBuildUnitFn()!(input)
export const deleteBuildUnitAction = (input: DeleteBuildUnitInput): Transaction =>
  deleteBuildUnitFn()!(input)

export function resetBuildUnitActions(): void {
  _create = null
  _update = null
  _delete = null
}
