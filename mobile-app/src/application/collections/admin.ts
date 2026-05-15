import { createCollection } from "@tanstack/react-db"
import { electricCollectionOptions } from "@tanstack/electric-db-collection"
import { persistedCollectionOptions } from "@tanstack/expo-db-sqlite-persistence"
import { z } from "zod"
import { MEMBERSHIP_ROLES } from "@buildinlime/domain-types"
import { trpc } from "../../infrastructure/trpc/client"
import { getPersistence } from "../../infrastructure/persistence/expo-persistence"
import { apiUrl, cookieFetch, retryOnError, coerceBool, parser } from "./_shared"

// --- Schemas ---

const electricUsersSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  email_verified: z.preprocess(coerceBool, z.boolean()).optional(),
  image: z.string().nullable().optional(),
  created_at: z.union([z.string(), z.date()]).optional(),
  updated_at: z.union([z.string(), z.date()]).optional(),
})

const selectTeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  owner_id: z.string(),
  project_id: z.string(),
  member_ids: z.preprocess(
    (v) => (typeof v === "string" ? JSON.parse(v) : v),
    z.array(z.string()).default([])
  ),
  created_at: z.union([z.string(), z.date()]).optional(),
})

const electricMembershipSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  channel_id: z.string(),
  buildunit_id: z.string(),
  project_id: z.string(),
  member_flag: z.preprocess(coerceBool, z.boolean()),
  role: z.enum(MEMBERSHIP_ROLES).default(`viewer`),
  created_at: z.union([z.string(), z.date()]).optional(),
})

// --- Factories ---

const USERS_SCHEMA_VERSION = 1

function _makeUsersCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
) {
  return createCollection(
    persistedCollectionOptions({
      ...electricCollectionOptions({
        id: `users`,
        shapeOptions: {
          url: `${apiUrl}/api/users`,
          fetchClient: cookieFetch,
          onError: retryOnError,
          parser,
        },
        schema: electricUsersSchema,
        getKey: (item) => item.id,
      }),
      persistence,
      schemaVersion: USERS_SCHEMA_VERSION,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
}

const TEAMS_SCHEMA_VERSION = 1

function _makeTeamsCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
) {
  return createCollection(
    persistedCollectionOptions({
      ...electricCollectionOptions({
        id: `teams`,
        shapeOptions: {
          url: `${apiUrl}/api/teams`,
          fetchClient: cookieFetch,
          onError: retryOnError,
          parser,
        },
        schema: selectTeamSchema,
        getKey: (item) => item.id,
        // onInsert/onUpdate removed — routed through
        // @tanstack/offline-transactions (see application/actions/teams.ts).
        onDelete: async ({ transaction }) => {
          const { original: t } = transaction.mutations[0]
          const result = await trpc.teams.delete.mutate({ id: t.id })
          return { txid: result.txid }
        },
      }),
      persistence,
      schemaVersion: TEAMS_SCHEMA_VERSION,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
}

const MEMBERSHIPS_SCHEMA_VERSION = 1

function _makeMembershipsCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
) {
  return createCollection(
    persistedCollectionOptions({
      ...electricCollectionOptions({
        id: `memberships`,
        shapeOptions: {
          url: `${apiUrl}/api/memberships`,
          fetchClient: cookieFetch,
          onError: retryOnError,
          parser,
        },
        schema: electricMembershipSchema,
        getKey: (item) => item.id,
      }),
      persistence,
      schemaVersion: MEMBERSHIPS_SCHEMA_VERSION,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
}

// ---------------------------------------------------------------------------
// Deferred exports — initialized by the orchestrator in application/collections/init.ts
// ES-module live bindings ensure importers always read the current value.
// ---------------------------------------------------------------------------
export let usersCollection: ReturnType<typeof _makeUsersCollection> = null!
export let teamsCollection: ReturnType<typeof _makeTeamsCollection> = null!
export let membershipsCollection: ReturnType<typeof _makeMembershipsCollection> = null!

export function initializeUsersCollection() {
  const { persistence } = getPersistence()
  usersCollection = _makeUsersCollection(persistence)
}

export function initializeTeamsCollection() {
  const { persistence } = getPersistence()
  teamsCollection = _makeTeamsCollection(persistence)
}

export function initializeMembershipsCollection() {
  const { persistence } = getPersistence()
  membershipsCollection = _makeMembershipsCollection(persistence)
}

export function resetAdminCollections() {
  usersCollection = null!
  teamsCollection = null!
  membershipsCollection = null!
}
