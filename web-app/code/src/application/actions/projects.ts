import type { Transaction } from "@tanstack/db"
import { projectsCollection } from "%/application/collections/organization"
import { getOfflineExecutor } from "%/infrastructure/offline/executor"

export type CreateProjectInput = {
  name: string
  description: string
  owner_id: string
}

let _create: ((v: CreateProjectInput) => Transaction) | null = null

function createProjectFn() {
  if (_create) return _create
  _create = getOfflineExecutor().createOfflineAction<CreateProjectInput>({
    mutationFnName: `createProject`,
    onMutate: (v: CreateProjectInput) => {
      projectsCollection.insert({
        id: crypto.randomUUID(),
        name: v.name,
        description: v.description,
        owner_id: v.owner_id,
        created_at: new Date(),
      })
    },
  })
  return _create
}

export const createProjectAction = (input: CreateProjectInput): Transaction =>
  createProjectFn()!(input)

export function resetProjectActions(): void {
  _create = null
}
