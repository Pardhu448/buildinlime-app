import { makeResourceActions } from "@buildinlime/sync-core"
import { resourcesCollection } from "../collections/communication"
import { getOfflineExecutor } from "../../infrastructure/offline/executor"

const { deleteResourceAction, resetResourceActions } = makeResourceActions({
  getExecutor: getOfflineExecutor,
  getCollection: () => resourcesCollection,
})

export { deleteResourceAction, resetResourceActions }
export type { DeleteResourceInput } from "@buildinlime/sync-core"
