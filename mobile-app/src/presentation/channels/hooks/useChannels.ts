import { useCollection } from "@tanstack/react-db"
import { useProjectContext } from "@/src/application/context/ProjectContext"
import type { Channel } from "@buildinlime/domain-types"

export function useChannels(buildUnitId: string) {
  const { collections } = useProjectContext()
  const { data, isLoading } = useCollection(collections!.channelsCollection, {
    select: (items) =>
      ([...items.values()] as Channel[]).filter((c) => c.buildunit_id === buildUnitId),
  })
  return { channels: data ?? [], isLoading }
}
