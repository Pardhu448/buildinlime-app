import { makeResourceActions, type DeleteResourceInput } from "@buildinlime/sync-core"
import { resourcesCollection } from "../collections/communication"
import { getOfflineExecutor } from "../../infrastructure/offline/executor"
import { evictResource } from "../../infrastructure/resources/resource-file-cache"

const { deleteResourceAction: _deleteResourceAction, resetResourceActions } =
  makeResourceActions({
    getExecutor: getOfflineExecutor,
    getCollection: () => resourcesCollection,
  })

// Deleting a resource is a soft delete: the server flips deleted_at and thereafter
// 404s the file route so the bytes are unreachable "for everyone". Purge this
// device's cached copy too, or the local file would keep the deleted bytes readable
// until sign-out (they wouldn't render — the row leaves resourcesCollection — but
// they would still sit on disk). Fire-and-forget: eviction has no bearing on the
// mutation, and if the delete later rolls back the file simply re-downloads on view.
//
// This covers the delete initiated ON THIS device. A delete performed by ANOTHER
// member arrives as a row-removal from Electric; it is intentionally NOT chased with
// a persistent collection subscription, because that would keep the IDLE_GC
// resources collection hydrated all session (GC only runs at zero subscribers) — so
// remotely-deleted bytes are cleared at sign-out instead.
export function deleteResourceAction(input: DeleteResourceInput) {
  void evictResource(input.id)
  return _deleteResourceAction(input)
}

export { resetResourceActions }
export type { DeleteResourceInput }
