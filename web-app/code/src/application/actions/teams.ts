import type { Transaction } from "@tanstack/db"
import { teamsCollection } from "%/application/collections/admin"
import { getOfflineExecutor } from "%/infrastructure/offline/executor"

export type CreateTeamInput = {
  name: string
  description?: string | null
  owner_id: string
  project_id: string
  member_ids: string[]
}

export type UpdateTeamInput = {
  id: string
  patch: {
    name?: string
    description?: string | null
    member_ids?: string[]
  }
}

let _create: ((v: CreateTeamInput) => Transaction) | null = null
let _update: ((v: UpdateTeamInput) => Transaction) | null = null

function createTeamFn() {
  if (_create) return _create
  _create = getOfflineExecutor().createOfflineAction<CreateTeamInput>({
    mutationFnName: `createTeam`,
    onMutate: (v: CreateTeamInput) => {
      teamsCollection.insert({
        id: crypto.randomUUID(),
        name: v.name,
        description: v.description ?? null,
        owner_id: v.owner_id,
        project_id: v.project_id,
        member_ids: v.member_ids,
        created_at: new Date(),
      })
    },
  })
  return _create
}

function updateTeamFn() {
  if (_update) return _update
  _update = getOfflineExecutor().createOfflineAction<UpdateTeamInput>({
    mutationFnName: `updateTeam`,
    onMutate: (v: UpdateTeamInput) => {
      teamsCollection.update(v.id, (t: Record<string, unknown>) => {
        if (v.patch.name !== undefined) t.name = v.patch.name
        if (v.patch.description !== undefined) t.description = v.patch.description
        if (v.patch.member_ids !== undefined) t.member_ids = v.patch.member_ids
      })
    },
  })
  return _update
}

export const createTeamAction = (input: CreateTeamInput): Transaction =>
  createTeamFn()!(input)
export const updateTeamAction = (input: UpdateTeamInput): Transaction =>
  updateTeamFn()!(input)

export function resetTeamActions(): void {
  _create = null
  _update = null
}
