import { useLiveQuery, eq } from "@tanstack/react-db"
import { useProjectContext } from "@/src/application/context/ProjectContext"

export function useChannels(buildUnitId: string) {
  const { collections } = useProjectContext()
  const { data, isLoading } = useLiveQuery(
    (q) =>
      q
        .from({ channelsCollection: collections!.channelsCollection })
        .where(({ channelsCollection: c }) => eq(c.buildunit_id, buildUnitId)),
    [collections, buildUnitId]
  )
  return { channels: data ?? [], isLoading }
}
