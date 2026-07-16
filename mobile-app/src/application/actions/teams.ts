import { makeTeamActions } from "@buildinlime/sync-core"
import * as Crypto from "expo-crypto"
import { teamsCollection } from "../collections/admin"
import { getOfflineExecutor } from "../../infrastructure/offline/executor"

const { createTeamAction, updateTeamAction, resetTeamActions } = makeTeamActions({
  randomUUID: () => Crypto.randomUUID(),
  getExecutor: getOfflineExecutor,
  getCollection: () => teamsCollection,
})

export { createTeamAction, updateTeamAction, resetTeamActions }
export type { CreateTeamInput, UpdateTeamInput } from "@buildinlime/sync-core"
