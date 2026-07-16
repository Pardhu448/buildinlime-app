import { makeTaskActions } from "@buildinlime/sync-core"
import { tasksCollection } from "%/application/collections/communication"
import { getOfflineExecutor } from "%/infrastructure/offline/executor"

// Shared factory (packages/sync-core) bound to the web executor + collection.
// getCollection reads the live `tasksCollection` binding so a resync-rebuilt
// collection is picked up after resetTaskActions(). See sync-core/platform.ts.
const { createTaskAction, updateTaskAction, deleteTaskAction, resetTaskActions } =
  makeTaskActions({
    randomUUID: () => crypto.randomUUID(),
    getExecutor: getOfflineExecutor,
    getCollection: () => tasksCollection,
  })

export { createTaskAction, updateTaskAction, deleteTaskAction, resetTaskActions }
export type {
  CreateTaskInput,
  UpdateTaskInput,
  DeleteTaskInput,
} from "@buildinlime/sync-core"
