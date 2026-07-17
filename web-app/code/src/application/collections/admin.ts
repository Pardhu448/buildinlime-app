import { userRowSchema, teamRowSchema } from "@buildinlime/contracts"
import { getPersistence } from "../../infrastructure/persistence/browser-persistence"
import { defineCollection, NEVER_GC } from "./_shared"

// Row schemas come from @buildinlime/contracts — one copy, shared with mobile and
// asserted against the drizzle tables server-side. See ARCHITECTURE.md §10.

// usersCollection is wrapped with SQLite persistence (OPFS) so the user list
// hydrates instantly from local cache on reload, even with the server offline.
function _makeUsersCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
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

// Deferred export — initialized by initializeUsersCollection() in
// _authenticated.beforeLoad after the persistence trio is ready.
export let usersCollection: ReturnType<typeof _makeUsersCollection> = null!

export async function initializeUsersCollection() {
  if (import.meta.env.DEV) console.log(`[OPFS:users] Initializing persisted collection…`)
  const t0 = performance.now()
  const { persistence } = await getPersistence()
  usersCollection = _makeUsersCollection(persistence)
  if (import.meta.env.DEV) console.log(`[OPFS:users] Collection created in ${(performance.now() - t0).toFixed(0)}ms`)
}

function _makeTeamsCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
) {
  return defineCollection({
    id: `teams`,
    path: `/api/teams`,
    schema: teamRowSchema,
    getKey: (item: { id: string }) => item.id,
    gcTime: NEVER_GC,
    persistence,
    // No handlers — team writes go through @tanstack/offline-transactions
    // (see application/actions/teams.ts). Delete is not currently used by UI;
    // add a mutationFn + action when needed.
  })
}

// Deferred export — initialized by initializeTeamsCollection()
export let teamsCollection: ReturnType<typeof _makeTeamsCollection> = null!

export async function initializeTeamsCollection() {
  if (import.meta.env.DEV) console.log(`[OPFS:teams] Initializing persisted collection…`)
  const t0 = performance.now()
  const { persistence } = await getPersistence()
  teamsCollection = _makeTeamsCollection(persistence)
  if (import.meta.env.DEV) console.log(`[OPFS:teams] Collection created in ${(performance.now() - t0).toFixed(0)}ms`)
}
