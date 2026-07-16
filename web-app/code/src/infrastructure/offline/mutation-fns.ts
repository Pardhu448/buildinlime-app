import { makeCoreMutationFns } from "@buildinlime/sync-core"
import { trpc } from "%/infrastructure/trpc/lib/trpc-client"

// Web's write surface is exactly the shared core spine (packages/sync-core).
// Projects, build units and channels are not created through the outbox on web —
// they are managed elsewhere — so there are no web-only additions here.
export const mutationFns = makeCoreMutationFns(trpc)
