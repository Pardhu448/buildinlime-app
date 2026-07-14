import { useLiveQuery, eq } from "@tanstack/react-db"
import { tasksCollection } from "@/src/application/collections/communication"
import type { Task } from "@buildinlime/domain-types"

/** Every task in a channel — what the channel's Tasks sheet lists. */
export function useChannelTasks(channelId: string) {
  const { data, isLoading } = useLiveQuery(
    (q) =>
      q
        .from({ tasksCollection })
        .where(({ tasksCollection: t }) => eq(t.channel_id, channelId)),
    [channelId]
  )
  return { tasks: (data ?? []) as Task[], isLoading }
}
