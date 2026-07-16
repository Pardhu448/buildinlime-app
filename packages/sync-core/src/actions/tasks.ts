import type { Transaction } from "@tanstack/db"
import type { OfflineExecutor, OptimisticCollection } from "../platform"

export type CreateTaskInput = {
  name: string
  description: string
  channel_id: string
  buildunit_id: string
  createdby_id: string
  assignee_id?: string | null
}

export type UpdateTaskInput = {
  id: string
  patch: {
    name?: string
    description?: string
    completed?: boolean
    assignee_id?: string | null
  }
}

export type DeleteTaskInput = { id: string }

// The optimistic row inserted at onMutate time — the client-generated id plus the
// task's initial state.
type TaskInsertRow = {
  id: string
  name: string
  description: string
  completed: boolean
  opened_at: Date
  closed_at: Date
  channel_id: string
  buildunit_id: string
  createdby_id: string
  assignee_id: string | null
}

export interface TaskActionsDeps {
  randomUUID: () => string
  getExecutor: () => OfflineExecutor
  getCollection: () => OptimisticCollection<TaskInsertRow>
}

export interface TaskActions {
  createTaskAction: (input: CreateTaskInput) => Transaction
  updateTaskAction: (input: UpdateTaskInput) => Transaction
  deleteTaskAction: (input: DeleteTaskInput) => Transaction
  resetTaskActions: () => void
}

// Builds the task write-actions bound to one app's executor + collection. The
// three actions are memoized on first use (createOfflineAction binds the executor
// instance live at that point); resetTaskActions() clears them so a rebuilt
// executor / collection is picked up on the next call. See platform.ts.
export function makeTaskActions(deps: TaskActionsDeps): TaskActions {
  const { randomUUID, getExecutor, getCollection } = deps

  let _create: ((v: CreateTaskInput) => Transaction) | null = null
  let _update: ((v: UpdateTaskInput) => Transaction) | null = null
  let _delete: ((v: DeleteTaskInput) => Transaction) | null = null

  function createFn() {
    if (_create) return _create
    _create = getExecutor().createOfflineAction<CreateTaskInput>({
      mutationFnName: `createTask`,
      onMutate: (v: CreateTaskInput) => {
        const now = new Date()
        getCollection().insert({
          id: randomUUID(),
          name: v.name,
          description: v.description,
          completed: false,
          opened_at: now,
          closed_at: now,
          channel_id: v.channel_id,
          buildunit_id: v.buildunit_id,
          createdby_id: v.createdby_id,
          assignee_id: v.assignee_id ?? null,
        })
      },
    })
    return _create
  }

  function updateFn() {
    if (_update) return _update
    _update = getExecutor().createOfflineAction<UpdateTaskInput>({
      mutationFnName: `updateTask`,
      onMutate: (v: UpdateTaskInput) => {
        getCollection().update(v.id, (task: Record<string, unknown>) => {
          if (v.patch.name !== undefined) task.name = v.patch.name
          if (v.patch.description !== undefined) task.description = v.patch.description
          if (v.patch.completed !== undefined) task.completed = v.patch.completed
          if (v.patch.assignee_id !== undefined) task.assignee_id = v.patch.assignee_id
        })
      },
    })
    return _update
  }

  function deleteFn() {
    if (_delete) return _delete
    _delete = getExecutor().createOfflineAction<DeleteTaskInput>({
      mutationFnName: `deleteTask`,
      onMutate: (v: DeleteTaskInput) => {
        getCollection().delete(v.id)
      },
    })
    return _delete
  }

  return {
    createTaskAction: (input: CreateTaskInput): Transaction => createFn()(input),
    updateTaskAction: (input: UpdateTaskInput): Transaction => updateFn()(input),
    deleteTaskAction: (input: DeleteTaskInput): Transaction => deleteFn()(input),
    resetTaskActions: (): void => {
      _create = null
      _update = null
      _delete = null
    },
  }
}
