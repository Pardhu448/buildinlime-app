import { makeMessageActions } from "@buildinlime/sync-core"
import { messagesCollection } from "%/application/collections/communication"
import { getOfflineExecutor } from "%/infrastructure/offline/executor"

const { createMessageAction, deleteMessageAction, resetMessageActions } =
  makeMessageActions({
    randomUUID: () => crypto.randomUUID(),
    getExecutor: getOfflineExecutor,
    getCollection: () => messagesCollection,
  })

export { createMessageAction, deleteMessageAction, resetMessageActions }
export type { CreateMessageInput, DeleteMessageInput } from "@buildinlime/sync-core"
