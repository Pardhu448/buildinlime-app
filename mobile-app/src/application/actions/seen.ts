import { makeSeenActions } from "@buildinlime/sync-core"
import { seenStateCollection, seenKey } from "../collections/communication"
import { getOfflineExecutor } from "../../infrastructure/offline/executor"

const { markSeenAction, resetSeenActions } = makeSeenActions({
  getExecutor: getOfflineExecutor,
  getCollection: () => seenStateCollection,
  seenKey,
})

export { markSeenAction, resetSeenActions }
export type { MarkSeenInput } from "@buildinlime/sync-core"
