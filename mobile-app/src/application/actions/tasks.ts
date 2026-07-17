import { makeTaskActions } from "@buildinlime/sync-core"
import * as Crypto from "expo-crypto"
import { tasksCollection } from "../collections/communication"
import { getOfflineExecutor } from "../../infrastructure/offline/executor"

// Shared factory (packages/sync-core) bound to the mobile executor + collection.
// Only the UUID source differs from web (expo-crypto vs the Web Crypto API).
const { createTaskAction, updateTaskAction, deleteTaskAction, resetTaskActions } =
  makeTaskActions({
    randomUUID: () => Crypto.randomUUID(),
    getExecutor: getOfflineExecutor,
    getCollection: () => tasksCollection,
  })

export { createTaskAction, updateTaskAction, deleteTaskAction, resetTaskActions }
export type {
  CreateTaskInput,
  UpdateTaskInput,
  DeleteTaskInput,
} from "@buildinlime/sync-core"
