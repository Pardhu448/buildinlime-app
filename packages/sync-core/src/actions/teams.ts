import type { Transaction } from "@tanstack/db"
import type { OfflineExecutor, OptimisticCollection } from "../platform"

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

type TeamInsertRow = {
  id: string
  name: string
  description: string | null
  owner_id: string
  project_id: string
  member_ids: string[]
  created_at: Date
}

export interface TeamActionsDeps {
  randomUUID: () => string
  getExecutor: () => OfflineExecutor
  getCollection: () => OptimisticCollection<TeamInsertRow>
}

export interface TeamActions {
  createTeamAction: (input: CreateTeamInput) => Transaction
  updateTeamAction: (input: UpdateTeamInput) => Transaction
  resetTeamActions: () => void
}

export function makeTeamActions(deps: TeamActionsDeps): TeamActions {
  const { randomUUID, getExecutor, getCollection } = deps

  let _create: ((v: CreateTeamInput) => Transaction) | null = null
  let _update: ((v: UpdateTeamInput) => Transaction) | null = null

  function createFn() {
    if (_create) return _create
    _create = getExecutor().createOfflineAction<CreateTeamInput>({
      mutationFnName: `createTeam`,
      onMutate: (v: CreateTeamInput) => {
        getCollection().insert({
          id: randomUUID(),
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

  function updateFn() {
    if (_update) return _update
    _update = getExecutor().createOfflineAction<UpdateTeamInput>({
      mutationFnName: `updateTeam`,
      onMutate: (v: UpdateTeamInput) => {
        getCollection().update(v.id, (t: Record<string, unknown>) => {
          if (v.patch.name !== undefined) t.name = v.patch.name
          if (v.patch.description !== undefined) t.description = v.patch.description
          if (v.patch.member_ids !== undefined) t.member_ids = v.patch.member_ids
        })
      },
    })
    return _update
  }

  return {
    createTeamAction: (input: CreateTeamInput): Transaction => createFn()(input),
    updateTeamAction: (input: UpdateTeamInput): Transaction => updateFn()(input),
    resetTeamActions: (): void => {
      _create = null
      _update = null
    },
  }
}
