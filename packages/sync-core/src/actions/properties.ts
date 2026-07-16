import type { Transaction } from "@tanstack/db"
import type {
  PropertyType,
  EntityType,
  StatusValue,
  PriorityValue,
  TaskStatusValue,
} from "@buildinlime/domain-types"
import type { OfflineExecutor, OptimisticCollection } from "../platform"

// Input matches a properties row (sans created_at). Property rows are sparse —
// different PropertyType variants populate different value fields — so a typed
// union per-type would be more boilerplate than benefit at this layer; the value
// columns stay loose strings on the public input.
export type CreatePropertyInput = {
  id: string
  type: string
  entity: string
  entity_id: string
  // Denormalized channel scope. MUST be set for channel- and task-entity
  // properties — the properties shape matches them BY channel_id, so a row that
  // persists with a null channel_id syncs back to nobody but its creator.
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

// Re-set an existing property's value. Only value columns are patchable — type /
// entity / entity_id identify the row and stay fixed, so a Status property can
// never silently become a Priority one.
export type UpdatePropertyInput = {
  id: string
  patch: Omit<CreatePropertyInput, "id" | "type" | "entity" | "entity_id" | "channel_id">
}

export type DeletePropertyInput = { id: string }

type PropertyInsertRow = {
  id: string
  type: PropertyType
  entity: EntityType
  entity_id: string
  channel_id: string | null
  status_value: StatusValue | null
  priority_value: PriorityValue | null
  task_status_value: TaskStatusValue | null
  target_date: string | null
  start_date: string | null
  pending_task: string | null
  percent_complete: string | null
  label_value: string | null
  created_at: Date
}

export interface PropertyActionsDeps {
  getExecutor: () => OfflineExecutor
  getCollection: () => OptimisticCollection<PropertyInsertRow>
}

export interface PropertyActions {
  createPropertyAction: (input: CreatePropertyInput) => Transaction
  updatePropertyAction: (input: UpdatePropertyInput) => Transaction
  deletePropertyAction: (input: DeletePropertyInput) => Transaction
  resetPropertyActions: () => void
}

export function makePropertyActions(deps: PropertyActionsDeps): PropertyActions {
  const { getExecutor, getCollection } = deps

  let _create: ((v: CreatePropertyInput) => Transaction) | null = null
  let _update: ((v: UpdatePropertyInput) => Transaction) | null = null
  let _delete: ((v: DeletePropertyInput) => Transaction) | null = null

  function createFn() {
    if (_create) return _create
    _create = getExecutor().createOfflineAction<CreatePropertyInput>({
      mutationFnName: `createProperty`,
      onMutate: (v: CreatePropertyInput) => {
        // The value columns are loose strings on the input; narrow them to the
        // domain enums for the optimistic row (selectPropertySchema requires
        // created_at, so it is stamped here).
        getCollection().insert({
          id: v.id,
          type: v.type as PropertyType,
          entity: v.entity as EntityType,
          entity_id: v.entity_id,
          channel_id: v.channel_id ?? null,
          status_value: (v.status_value ?? null) as StatusValue | null,
          priority_value: (v.priority_value ?? null) as PriorityValue | null,
          task_status_value: (v.task_status_value ?? null) as TaskStatusValue | null,
          target_date: v.target_date ?? null,
          start_date: v.start_date ?? null,
          pending_task: v.pending_task ?? null,
          percent_complete: v.percent_complete ?? null,
          label_value: v.label_value ?? null,
          created_at: new Date(),
        })
      },
    })
    return _create
  }

  function updateFn() {
    if (_update) return _update
    _update = getExecutor().createOfflineAction<UpdatePropertyInput>({
      mutationFnName: `updateProperty`,
      onMutate: (v: UpdatePropertyInput) => {
        getCollection().update(v.id, (property: Record<string, unknown>) => {
          Object.assign(property, v.patch)
        })
      },
    })
    return _update
  }

  function deleteFn() {
    if (_delete) return _delete
    _delete = getExecutor().createOfflineAction<DeletePropertyInput>({
      mutationFnName: `deleteProperty`,
      onMutate: (v: DeletePropertyInput) => {
        getCollection().delete(v.id)
      },
    })
    return _delete
  }

  return {
    createPropertyAction: (input: CreatePropertyInput): Transaction => createFn()(input),
    updatePropertyAction: (input: UpdatePropertyInput): Transaction => updateFn()(input),
    deletePropertyAction: (input: DeletePropertyInput): Transaction => deleteFn()(input),
    resetPropertyActions: (): void => {
      _create = null
      _update = null
      _delete = null
    },
  }
}
