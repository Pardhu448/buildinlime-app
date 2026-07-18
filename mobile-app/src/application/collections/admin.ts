import { userRowSchema } from "@buildinlime/contracts"
import { getPersistence } from "../../infrastructure/persistence/expo-persistence"
import { defineCollection, NEVER_GC, safeCleanup } from "./_shared"

// Row schemas come from @buildinlime/contracts — one copy, shared with web and
// asserted against the drizzle tables server-side. See ARCHITECTURE.md §10.
//
// This file holds the collections that belong to no single domain — users.
// memberships and seen_state used to live here too, which put them in a
// different module than web keeps them in. They now sit where their tables do
// (organization-tables.ts / communication-tables.ts) and where web already had
// them: memberships in ./organization, seen_state in ./communication.

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

// ---------------------------------------------------------------------------
// Deferred exports — initialized by the orchestrator in application/collections/init.ts
// ES-module live bindings ensure importers always read the current value.
// ---------------------------------------------------------------------------
export let usersCollection: ReturnType<typeof _makeUsersCollection> = null!

export function initializeUsersCollection() {
  const { persistence } = getPersistence()
  safeCleanup(usersCollection)
  usersCollection = _makeUsersCollection(persistence)
}

export function resetAdminCollections() {
  // Stop sync before dropping the references (GC won't do it — it's disabled).
  safeCleanup(usersCollection)
  usersCollection = null!
}
