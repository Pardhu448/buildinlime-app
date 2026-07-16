import {
  userRowSchema,
  teamRowSchema,
  membershipRowSchema,
  seenStateRowSchema,
} from "@buildinlime/contracts"
import { trpc } from "../../infrastructure/trpc/client"
import { getPersistence } from "../../infrastructure/persistence/expo-persistence"
import { defineCollection, retryOnMembershipsError, NEVER_GC, safeCleanup } from "./_shared"

// Row schemas come from @buildinlime/contracts — one copy, shared with web and
// asserted against the drizzle tables server-side. See ARCHITECTURE.md §10.

// --- Factories ---

function _makeUsersCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
) {
  return defineCollection({
    id: `users`,
    path: `/api/users`,
    schema: userRowSchema,
    getKey: (item: { id: string }) => item.id,
    gcTime: NEVER_GC,
    persistence,
  })
}

/**
 * The current user's "last seen" markers — the timestamp successor to the reads
 * collection. Shape scoped `user_id = me` server-side (web-app
 * routes/api/seen-state.ts) with no query parameter able to widen it — so it
 * takes no membership ids and never rebuilds on scope change, exactly like reads.
 *
 * Key is composite: one row per (user, scope, scope_id). NEVER_GC because the
 * always-mounted DrawerContent badges subscribe to it, so it never idles.
 */
export const seenKey = (userId: string, scope: string, scopeId: string) =>
  `${userId}:${scope}:${scopeId}`

function _makeSeenStateCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
) {
  return defineCollection({
    id: `seen-state`,
    path: `/api/seen-state`,
    schema: seenStateRowSchema,
    getKey: (item: { user_id: string; scope: string; scope_id: string }) =>
      seenKey(item.user_id, item.scope, item.scope_id),
    gcTime: NEVER_GC,
    persistence,
  })
}

function _makeTeamsCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
) {
  return defineCollection({
    id: `teams`,
    path: `/api/teams`,
    schema: teamRowSchema,
    getKey: (item: { id: string }) => item.id,
    gcTime: NEVER_GC,
    persistence,
    handlers: {
      // onInsert/onUpdate omitted — teams are created and edited on web only.
      onDelete: async ({ transaction }: { transaction: { mutations: { original: { id: string } }[] } }) => {
        const { original: t } = transaction.mutations[0]
        const result = await trpc.teams.delete.mutate({ id: t.id })
        return { txid: result.txid }
      },
    },
  })
}

function _makeMembershipsCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
) {
  return defineCollection({
    id: `memberships`,
    path: `/api/memberships`,
    schema: membershipRowSchema,
    getKey: (item: { id: string }) => item.id,
    gcTime: NEVER_GC,
    persistence,
    // Reports the error before retrying, so the bootstrap can tell a clean empty
    // sync apart from a shape that failed and was marked ready anyway — see
    // retryOnMembershipsError.
    onError: retryOnMembershipsError,
  })
}

// ---------------------------------------------------------------------------
// Deferred exports — initialized by the orchestrator in application/collections/init.ts
// ES-module live bindings ensure importers always read the current value.
// ---------------------------------------------------------------------------
export let usersCollection: ReturnType<typeof _makeUsersCollection> = null!
export let teamsCollection: ReturnType<typeof _makeTeamsCollection> = null!
export let membershipsCollection: ReturnType<typeof _makeMembershipsCollection> = null!
export let seenStateCollection: ReturnType<typeof _makeSeenStateCollection> = null!

export function initializeUsersCollection() {
  const { persistence } = getPersistence()
  safeCleanup(usersCollection)
  usersCollection = _makeUsersCollection(persistence)
}

export function initializeSeenStateCollection() {
  const { persistence } = getPersistence()
  safeCleanup(seenStateCollection)
  seenStateCollection = _makeSeenStateCollection(persistence)
}

export function initializeTeamsCollection() {
  const { persistence } = getPersistence()
  safeCleanup(teamsCollection)
  teamsCollection = _makeTeamsCollection(persistence)
}

export function initializeMembershipsCollection() {
  const { persistence } = getPersistence()
  safeCleanup(membershipsCollection)
  membershipsCollection = _makeMembershipsCollection(persistence)
}

export function resetAdminCollections() {
  // Stop sync before dropping the references (GC won't do it — it's disabled).
  safeCleanup(usersCollection)
  safeCleanup(teamsCollection)
  safeCleanup(membershipsCollection)
  safeCleanup(seenStateCollection)
  usersCollection = null!
  teamsCollection = null!
  membershipsCollection = null!
  seenStateCollection = null!
}
