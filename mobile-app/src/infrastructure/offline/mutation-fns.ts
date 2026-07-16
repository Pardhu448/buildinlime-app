import { makeCoreMutationFns } from "@buildinlime/sync-core"
import { trpc } from "../trpc/client"

// The shared core spine (tasks / messages / resources / properties / teams / seen)
// lives in packages/sync-core. Projects, build units, channels and teams are
// created and managed on web only — mobile reads those collections but never
// writes them, so it drives no outbox mutations of its own.

export const mutationFns = makeCoreMutationFns(trpc)
