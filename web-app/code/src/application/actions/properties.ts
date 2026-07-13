import type { Transaction } from "@tanstack/db"
import { propertiesCollection } from "%/application/collections/communication"
import { getOfflineExecutor } from "%/infrastructure/offline/executor"

// Input matches a row in the properties table (sans created_at).
// We pass the full shape because property rows are sparse — different
// PropertyType variants populate different value fields — so a typed
// union per-type would be more boilerplate than benefit at this layer.
export type CreatePropertyInput = {
  id: string
  type: string
  entity: string
  entity_id: string
  // Denormalized channel scope: the channel itself for channel-entity
  // properties, the task's channel for task-entity properties, null for
  // project/build-unit properties. Drives the channel-scoped properties shape.
  channel_id?: string | null
  status_value?: string | null
  priority_value?: string | null
  task_status_value?: string | null
  target_date?: string | null
  start_date?: string | null
  pending_task?: string | null
  percent_complete?: string | null
  label_value?: string | null
}

/**
 * Re-set an existing property's value. Only the value columns are patchable —
 * `type` / `entity` / `entity_id` identify the row and stay fixed, so a "Status"
 * property can never silently become a "Priority" one.
 */
export type UpdatePropertyInput = {
  id: string
  patch: Omit<CreatePropertyInput, "id" | "type" | "entity" | "entity_id" | "channel_id">
}

export type DeletePropertyInput = { id: string }

let _create: ((v: CreatePropertyInput) => Transaction) | null = null
let _update: ((v: UpdatePropertyInput) => Transaction) | null = null
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

function updatePropertyFn() {
  if (_update) return _update
  _update = getOfflineExecutor().createOfflineAction<UpdatePropertyInput>({
    mutationFnName: `updateProperty`,
    onMutate: (v: UpdatePropertyInput) => {
      propertiesCollection.update(v.id, (property: Record<string, unknown>) => {
        Object.assign(property, v.patch)
      })
    },
  })
  return _update
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
export const updatePropertyAction = (input: UpdatePropertyInput): Transaction =>
  updatePropertyFn()!(input)
export const deletePropertyAction = (input: DeletePropertyInput): Transaction =>
  deletePropertyFn()!(input)

export function resetPropertyActions(): void {
  _create = null
  _update = null
  _delete = null
}
