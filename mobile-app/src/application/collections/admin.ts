import { createCollection } from "@tanstack/react-db"
import { electricCollectionOptions } from "@tanstack/electric-db-collection"
import { persistedCollectionOptions } from "@tanstack/expo-db-sqlite-persistence"
import { z } from "zod"
import { MEMBERSHIP_ROLES, READ_ITEM_TYPES } from "@buildinlime/domain-types"
import { trpc } from "../../infrastructure/trpc/client"
import { getPersistence } from "../../infrastructure/persistence/expo-persistence"
import { apiUrl, cookieFetch, retryOnError, retryOnMembershipsError, coerceBool, parser, NEVER_GC, safeCleanup } from "./_shared"

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

// Per-user read state. Unread is the ABSENCE of a row — nothing to backfill for
// content that predates the feature, it simply all starts unread.
const electricReadSchema = z.object({
  user_id: z.string(),
  item_type: z.preprocess(
    (v) => (typeof v === "string" && v.startsWith(`"`) ? JSON.parse(v) : v),
    z.enum(READ_ITEM_TYPES)
  ),
  item_id: z.string(),
  channel_id: z.string(),
  read_at: z.union([z.string(), z.date()]).optional(),
})

// Both the SELF stream (this file's membershipsCollection, `user_id = me`) and the
// ROSTER stream (organization.ts's channelMembersCollection, every member of the
// visible channels) read the same `memberships` table, so they share one schema.
export const electricMembershipSchema = z.object({
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

const USERS_SCHEMA_VERSION = 3

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
        gcTime: NEVER_GC,
      }),
      persistence,
      schemaVersion: USERS_SCHEMA_VERSION,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
}

const READS_SCHEMA_VERSION = 3

/**
 * The current user's read state. The shape is scoped `user_id = me` server-side
 * (web-app routes/api/reads.ts) with no query parameter able to widen it — so
 * unlike the scoped collections this takes no membership ids and never needs
 * rebuilding when the visible channel set changes.
 *
 * The key is composite: one row per (user, item_type, item_id).
 */
export const readKey = (userId: string, itemType: string, itemId: string) =>
  `${userId}:${itemType}:${itemId}`

function _makeReadsCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
) {
  return createCollection(
    persistedCollectionOptions({
      ...electricCollectionOptions({
        id: `reads`,
        shapeOptions: {
          url: `${apiUrl}/api/reads`,
          fetchClient: cookieFetch,
          onError: retryOnError,
          parser,
        },
        schema: electricReadSchema,
        getKey: (item) => readKey(item.user_id, item.item_type, item.item_id),
        gcTime: NEVER_GC,
      }),
      persistence,
      schemaVersion: READS_SCHEMA_VERSION,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
}

const TEAMS_SCHEMA_VERSION = 3

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
        gcTime: NEVER_GC,
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

const MEMBERSHIPS_SCHEMA_VERSION = 3

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
          // Reports the error before retrying, so the bootstrap can tell a clean
          // empty sync apart from a shape that failed and was marked ready anyway
          // — see retryOnMembershipsError.
          onError: retryOnMembershipsError,
          parser,
        },
        schema: electricMembershipSchema,
        getKey: (item) => item.id,
        gcTime: NEVER_GC,
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
export let readsCollection: ReturnType<typeof _makeReadsCollection> = null!

export function initializeUsersCollection() {
  const { persistence } = getPersistence()
  safeCleanup(usersCollection)
  usersCollection = _makeUsersCollection(persistence)
}

export function initializeReadsCollection() {
  const { persistence } = getPersistence()
  safeCleanup(readsCollection)
  readsCollection = _makeReadsCollection(persistence)
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
  safeCleanup(readsCollection)
  usersCollection = null!
  teamsCollection = null!
  membershipsCollection = null!
  readsCollection = null!
}
