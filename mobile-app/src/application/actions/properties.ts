import type { Transaction } from "@tanstack/db"
import { propertiesCollection } from "../collections/communication"
import { getOfflineExecutor } from "../../infrastructure/offline/executor"

// Input matches a row in the properties table (sans created_at).
// We pass the full shape because property rows are sparse — different
// PropertyType variants populate different value fields — so a typed
// union per-type would be more boilerplate than benefit at this layer.
export type CreatePropertyInput = {
  id: string
  type: string
  entity: string
  entity_id: string
  status_value?: string | null
  priority_value?: string | null
  target_date?: string | null
  start_date?: string | null
  pending_task?: string | null
  label_value?: string | null
}

export type DeletePropertyInput = { id: string }

let _create: ((v: CreatePropertyInput) => Transaction) | null = null
let _delete: ((v: DeletePropertyInput) => Transaction) | null = null

function createPropertyFn() {
  if (_create) return _create
  _create = getOfflineExecutor().createOfflineAction<CreatePropertyInput>({
    mutationFnName: `createProperty`,
    onMutate: (v: CreatePropertyInput) => {
      propertiesCollection.insert({
        ...v,
        // selectPropertySchema requires created_at; missing it silently
        // fails the collection's optimistic-write schema validation.
        created_at: new Date(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    },
  })
  return _create
}

function deletePropertyFn() {
  if (_delete) return _delete
  _delete = getOfflineExecutor().createOfflineAction<DeletePropertyInput>({
    mutationFnName: `deleteProperty`,
    onMutate: (v: DeletePropertyInput) => {
      propertiesCollection.delete(v.id)
    },
  })
  return _delete
}

export const createPropertyAction = (input: CreatePropertyInput): Transaction =>
  createPropertyFn()!(input)
export const deletePropertyAction = (input: DeletePropertyInput): Transaction =>
  deletePropertyFn()!(input)

export function resetPropertyActions(): void {
  _create = null
  _delete = null
}
