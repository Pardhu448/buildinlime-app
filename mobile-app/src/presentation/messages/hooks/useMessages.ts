import { useLiveQuery, eq } from "@tanstack/react-db"
import { messagesCollection } from "@/src/application/collections/communication"
import type { Message } from "@buildinlime/domain-types"

export function useMessages(channelId: string) {
  const { data, isLoading } = useLiveQuery(
    (q) =>
      q
        .from({ messagesCollection })
        .where(({ messagesCollection: m }) => eq(m.channel_id, channelId)),
    [channelId]
  )
  const toMs = (d: Date | string | undefined): number => {
    if (!d) return 0
    if (d instanceof Date) {
      const t = d.getTime()
      return isNaN(t) ? 0 : t
    }
    // Normalize PostgreSQL timestamp format in case the parser didn't run
    const normalized = d.replace(' ', 'T').replace(/\+00(?::00)?$/, 'Z')
    const t = new Date(normalized).getTime()
    return isNaN(t) ? 0 : t
  }
  const messages = ((data ?? []) as Message[]).sort(
    (a, b) => toMs(a.created_at) - toMs(b.created_at)
  )
  return { messages, isLoading }
}
