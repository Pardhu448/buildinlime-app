import { makeCoreMutationFns } from "@buildinlime/sync-core"
import { trpc } from "%/infrastructure/trpc/lib/trpc-client"
import { messagesCollection } from "%/application/collections/communication"

// Web's write surface is exactly the shared core spine (packages/sync-core).
// Projects, build units and channels are not created through the outbox on web —
// they are managed elsewhere — so there are no web-only additions here.
//
// The txid handshake holds messages.create open until the synced row lands.
// Web has never shown the vanish this fixes on mobile (see
// DISAPPEARING_MESSAGES_INVESTIGATION.md §9.3) — it is wired here so messages match
// projects / build units / channels, which have always run this same handshake.
// Read as an arrow function, NOT a captured collection: messagesCollection is
// reassigned on project switch.
export const mutationFns = makeCoreMutationFns(trpc, {
  awaitTxId: {
    messages: (txid) => messagesCollection.utils.awaitTxId(txid),
  },
})
