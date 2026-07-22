import { makeCoreMutationFns } from "@buildinlime/sync-core"
import { trpc } from "../trpc/client"
import { messagesCollection } from "@/src/application/collections/communication"

// The shared core spine (tasks / messages / resources / properties / teams / seen)
// lives in packages/sync-core. Projects, build units, channels and teams are
// created and managed on web only — mobile reads those collections but never
// writes them, so it drives no outbox mutations of its own.

// The txid handshake: hold `messages.create` open until the synced row lands, so
// the optimistic bubble is never dropped into an empty gap. Read as an arrow
// function, NOT a captured collection — messagesCollection is reassigned on
// project switch. See CoreMutationHooks and DISAPPEARING_MESSAGES_INVESTIGATION.md
// §9.3.
export const mutationFns = makeCoreMutationFns(trpc, {
  awaitTxId: {
    messages: (txid) => messagesCollection.utils.awaitTxId(txid),
  },
})
