import { makeTeamActions } from "@buildinlime/sync-core"
import { teamsCollection } from "%/application/collections/admin"
import { getOfflineExecutor } from "%/infrastructure/offline/executor"

const { createTeamAction, updateTeamAction, resetTeamActions } = makeTeamActions({
  randomUUID: () => crypto.randomUUID(),
  getExecutor: getOfflineExecutor,
  getCollection: () => teamsCollection,
})

export { createTeamAction, updateTeamAction, resetTeamActions }
export type { CreateTeamInput, UpdateTeamInput } from "@buildinlime/sync-core"
