import { createCollection } from "@tanstack/react-db"
import { electricCollectionOptions } from "@tanstack/electric-db-collection"
import { persistedCollectionOptions } from "@tanstack/browser-db-sqlite-persistence"
import { z } from "zod"
import { selectTeamSchema } from "%/infrastructure/database/schema/admin-schema"
import { getPersistence } from "../../infrastructure/persistence/browser-persistence"
import { retryOnError, origin, NEVER_GC } from "./_shared"

// Electric returns the actual DB column names (snake_case), not the camelCase
// JS property names that drizzle-zod generates from the auth-schema users table.
// Note: Electric returns boolean columns as the string "true"/"false", so
// email_verified needs z.preprocess to coerce before boolean validation.
const electricUsersSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  email_verified: z.preprocess((v) => v === "true" || v === true, z.boolean()).optional(),
  image: z.string().nullable().optional(),
  created_at: z.union([z.string(), z.date()]).optional(),
  updated_at: z.union([z.string(), z.date()]).optional(),
})

const electricTeamSchema = selectTeamSchema.extend({
  member_ids: z.preprocess(
    (v) => (typeof v === "string" ? JSON.parse(v) : v),
    z.array(z.string()).default([])
  ),
})

// usersCollection is wrapped with SQLite persistence (OPFS) so the user list
// hydrates instantly from local cache on reload, even with the server offline.
// Bump USERS_SCHEMA_VERSION whenever electricUsersSchema changes shape — a
// version mismatch triggers a full reset and re-sync from Electric.
const USERS_SCHEMA_VERSION = 3

function _makeUsersCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
) {
  return createCollection(
    persistedCollectionOptions({
      ...electricCollectionOptions({
        id: `users`,
        shapeOptions: {
          url: new URL(`/api/users`, origin).toString(),
          onError: retryOnError,
          parser: {
            timestamptz: (date: string) => {
              return new Date(date)
            },
          },
        },
        schema: electricUsersSchema,
        getKey: (item) => item.id,
        gcTime: NEVER_GC,
      }),
      persistence,
      schemaVersion: USERS_SCHEMA_VERSION,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
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

const TEAMS_SCHEMA_VERSION = 3

function _makeTeamsCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
) {
  return createCollection(
    persistedCollectionOptions({
      ...electricCollectionOptions({
        id: `teams`,
        shapeOptions: {
          url: new URL(`/api/teams`, origin).toString(),
          onError: retryOnError,
          parser: {
            timestamptz: (date: string) => new Date(date),
          },
        },
        schema: electricTeamSchema,
        getKey: (item) => item.id,
        gcTime: NEVER_GC,
        // Team writes go through @tanstack/offline-transactions —
        // see application/actions/teams.ts. Delete is not currently used
        // by UI; add a mutationFn + action when needed.
      }),
      persistence,
      schemaVersion: TEAMS_SCHEMA_VERSION,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
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
