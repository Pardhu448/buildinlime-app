import { useLiveQuery, eq } from "@tanstack/react-db"
import { channelsCollection } from "@/src/application/collections/organization"

export function useChannels(buildUnitId: string) {
  const { data, isLoading } = useLiveQuery(
    (q) =>
      q
        .from({ channelsCollection })
        .where(({ channelsCollection: c }) => eq(c.buildunit_id, buildUnitId)),
    [buildUnitId]
  )
  return { channels: data ?? [], isLoading }
}
