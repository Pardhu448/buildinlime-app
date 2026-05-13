import type { Transaction } from "@tanstack/db"
import { resourcesCollection } from "%/application/collections/communication"
import { getOfflineExecutor } from "%/infrastructure/offline/executor"

export type DeleteResourceInput = { id: string }

let _delete: ((v: DeleteResourceInput) => Transaction) | null = null

function deleteResourceFn() {
  if (_delete) return _delete
  _delete = getOfflineExecutor().createOfflineAction<DeleteResourceInput>({
    mutationFnName: `deleteResource`,
    onMutate: (v: DeleteResourceInput) => {
      resourcesCollection.delete(v.id)
    },
  })
  return _delete
}

export const deleteResourceAction = (input: DeleteResourceInput): Transaction =>
  deleteResourceFn()!(input)

export function resetResourceActions(): void {
  _delete = null
}
