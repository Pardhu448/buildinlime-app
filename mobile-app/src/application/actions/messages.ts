import { makeMessageActions } from "@buildinlime/sync-core"
import * as Crypto from "expo-crypto"
import { messagesCollection } from "../collections/communication"
import { getOfflineExecutor } from "../../infrastructure/offline/executor"

const { createMessageAction, deleteMessageAction, resetMessageActions } =
  makeMessageActions({
    randomUUID: () => Crypto.randomUUID(),
    getExecutor: getOfflineExecutor,
    getCollection: () => messagesCollection,
  })

export { createMessageAction, deleteMessageAction, resetMessageActions }
export type { CreateMessageInput, DeleteMessageInput } from "@buildinlime/sync-core"
