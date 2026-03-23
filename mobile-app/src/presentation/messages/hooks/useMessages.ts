import { useCollection } from "@tanstack/react-db"
import { useProjectContext } from "@/src/application/context/ProjectContext"
import type { Message } from "@buildinlime/domain-types"

export function useMessages(channelId: string) {
  const { collections } = useProjectContext()
  const { data, isLoading } = useCollection(collections!.messagesCollection, {
    select: (items) =>
      ([...items.values()] as Message[])
        .filter((m) => m.channel_id === channelId)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
  })
  return { messages: data ?? [], isLoading }
}
