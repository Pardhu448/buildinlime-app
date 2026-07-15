import { useMemo } from "react"
import { useLiveQuery } from "@tanstack/react-db"
import {
  readsCollection,
  myTasksCollection,
} from "%/infrastructure/database/tanstack-db-electric/admincollections"

/**
 * The Sidebar "My Tasks" badge: how many tasks assigned to me are still open and
 * unopened.
 *
 * Reads the user-scoped `my-tasks` slice, NOT the full `tasks` collection. The
 * slice is filtered server-side to `assignee_id = me AND deleted_at IS NULL`
 * (see routes/api/my-tasks.ts), so the always-mounted badge no longer holds every
 * channel's tasks open — which is what now lets the full `tasks` collection
 * garbage-collect when no channel/task view is mounted.
 */
export function useMyTasksBadge() {
  const { data: reads } = useLiveQuery((q) => q.from({ readsCollection }), [])
  const { data: myTasks } = useLiveQuery(
    (q) => q.from({ myTasksCollection }),
    [],
  )

  const readTaskIds = useMemo(
    () =>
      new Set(
        (reads ?? []).filter((r) => r.item_type === "task").map((r) => r.item_id),
      ),
    [reads],
  )

  // The slice already guarantees these are assigned to me and not deleted; we
  // only drop completed and already-opened ones. `completed` is a column, not
  // part of the server-side filter, so it is checked here.
  const myUnopenedTaskCount = useMemo(
    () =>
      (myTasks ?? []).filter((t) => !t.completed && !readTaskIds.has(t.id)).length,
    [myTasks, readTaskIds],
  )

  return { myUnopenedTaskCount }
}
