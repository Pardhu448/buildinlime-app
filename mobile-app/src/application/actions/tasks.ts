import type { Transaction } from "@tanstack/db"
import * as Crypto from "expo-crypto"
import { tasksCollection } from "../collections/communication"
import { getOfflineExecutor } from "../../infrastructure/offline/executor"

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

let _create: ((v: CreateTaskInput) => Transaction) | null = null
let _update: ((v: UpdateTaskInput) => Transaction) | null = null
let _delete: ((v: DeleteTaskInput) => Transaction) | null = null

function createTaskFn() {
  if (_create) return _create
  _create = getOfflineExecutor().createOfflineAction<CreateTaskInput>({
    mutationFnName: `createTask`,
    onMutate: (v: CreateTaskInput) => {
      const now = new Date()
      tasksCollection.insert({
        id: Crypto.randomUUID(),
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

function updateTaskFn() {
  if (_update) return _update
  _update = getOfflineExecutor().createOfflineAction<UpdateTaskInput>({
    mutationFnName: `updateTask`,
    onMutate: (v: UpdateTaskInput) => {
      tasksCollection.update(v.id, (t: Record<string, unknown>) => {
        if (v.patch.name !== undefined) t.name = v.patch.name
        if (v.patch.description !== undefined) t.description = v.patch.description
        if (v.patch.completed !== undefined) t.completed = v.patch.completed
        if (v.patch.assignee_id !== undefined) t.assignee_id = v.patch.assignee_id
      })
    },
  })
  return _update
}

function deleteTaskFn() {
  if (_delete) return _delete
  _delete = getOfflineExecutor().createOfflineAction<DeleteTaskInput>({
    mutationFnName: `deleteTask`,
    onMutate: (v: DeleteTaskInput) => {
      tasksCollection.delete(v.id)
    },
  })
  return _delete
}

export const createTaskAction = (input: CreateTaskInput): Transaction => createTaskFn()!(input)
export const updateTaskAction = (input: UpdateTaskInput): Transaction => updateTaskFn()!(input)
export const deleteTaskAction = (input: DeleteTaskInput): Transaction => deleteTaskFn()!(input)

export function resetTaskActions(): void {
  _create = null
  _update = null
  _delete = null
}
