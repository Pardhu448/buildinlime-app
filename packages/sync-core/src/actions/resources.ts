import type { Transaction } from "@tanstack/db"
import type { OfflineExecutor, OptimisticCollection } from "../platform"

export type DeleteResourceInput = { id: string }

export interface ResourceActionsDeps {
  getExecutor: () => OfflineExecutor
  // Delete-only: the row is never inserted through this path (uploads create
  // resources directly — see ARCHITECTURE.md §8), so the insert row type is never.
  getCollection: () => OptimisticCollection<never>
}

export interface ResourceActions {
  deleteResourceAction: (input: DeleteResourceInput) => Transaction
  resetResourceActions: () => void
}

export function makeResourceActions(deps: ResourceActionsDeps): ResourceActions {
  const { getExecutor, getCollection } = deps

  let _delete: ((v: DeleteResourceInput) => Transaction) | null = null

  function deleteFn() {
    if (_delete) return _delete
    _delete = getExecutor().createOfflineAction<DeleteResourceInput>({
      mutationFnName: `deleteResource`,
      onMutate: (v: DeleteResourceInput) => {
        getCollection().delete(v.id)
      },
    })
    return _delete
  }

  return {
    deleteResourceAction: (input: DeleteResourceInput): Transaction => deleteFn()(input),
    resetResourceActions: (): void => {
      _delete = null
    },
  }
}
