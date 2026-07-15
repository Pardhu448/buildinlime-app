import { useMemo } from "react"
import { useLiveQuery } from "@tanstack/react-db"
import { myTasksCollection } from "%/infrastructure/database/tanstack-db-electric/admincollections"
import { coerceBool } from "%/application/collections/_shared"
import { useSeen } from "%/presentation/hooks/use-seen"

/**
 * The Sidebar "My Tasks" badge: how many tasks assigned to me are still open and
 * arrived since I last opened My Tasks.
 *
 * Reads the user-scoped `my-tasks` slice + a single `mytasks` seen timestamp (not
 * the full tasks collection, and no per-item reads). A task is unseen iff
 * opened_at > mytasksSeenAt; opening My Tasks pushes that timestamp forward (on
 * leave), clearing the badge.
 */
export function useMyTasksBadge() {
  const { mytasksSeenAt } = useSeen()

  const { data: myTasks } = useLiveQuery(
    (q) => q.from({ myTasksCollection }),
    [],
  )

  // coerceBool: Electric delivers boolean columns as the STRING "false"/"true"
  // on SYNCED rows (the schema's coerceBool preprocess only runs on optimistic
  // client writes, not on sync — there is no boolean parser). A bare `!t.completed`
  // would read the non-empty string "false" as truthy and drop every open task,
  // pinning the badge at 0.
  const myUnopenedTaskCount = useMemo(
    () =>
      (myTasks ?? []).filter(
        (t) =>
          !coerceBool(t.completed) &&
          new Date(t.opened_at as string | Date) > mytasksSeenAt,
      ).length,
    [myTasks, mytasksSeenAt],
  )

  return { myUnopenedTaskCount }
}
