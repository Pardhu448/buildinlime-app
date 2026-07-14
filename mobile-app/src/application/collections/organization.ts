import { createCollection } from "@tanstack/react-db"
import { electricCollectionOptions } from "@tanstack/electric-db-collection"
import { persistedCollectionOptions } from "@tanstack/expo-db-sqlite-persistence"
import { z } from "zod"
import { CHANNEL_NAMES } from "@buildinlime/domain-types"
import { electricMembershipSchema } from "./admin"
import { trpc } from "../../infrastructure/trpc/client"
import { getPersistence } from "../../infrastructure/persistence/expo-persistence"
import { apiUrl, cookieFetch, retryOnError, unwrapJsonb, parser, NEVER_GC, safeCleanup } from "./_shared"

// --- Schemas ---

const selectProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  owner_id: z.string(),
  priority: z.preprocess(unwrapJsonb, z.enum(["High", "Mid", "Low"]).nullish()),
  target_date: z.string().nullable().optional(),
  status_percent: z.string().nullable().optional(),
  created_at: z.union([z.string(), z.date()]).optional(),
})

const selectBuildUnitSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  project_id: z.string(),
  owner_id: z.string(),
  health: z.preprocess(unwrapJsonb, z.enum(["On track", "At risk", "Off track"]).nullish()),
  priority: z.preprocess(unwrapJsonb, z.enum(["High", "Mid", "Low"]).nullish()),
  task_name: z.string().nullable().optional(),
  task_assignee: z.string().nullable().optional(),
  task_since: z.string().nullable().optional(),
  target_date: z.string().nullable().optional(),
  status_percent: z.string().nullable().optional(),
  created_at: z.union([z.string(), z.date()]).optional(),
})

const selectChannelSchema = z.object({
  id: z.string(),
  name: z.preprocess(unwrapJsonb, z.enum(CHANNEL_NAMES)),
  description: z.string().nullable().optional(),
  buildunit_id: z.string(),
  owner_id: z.string(),
  created_at: z.union([z.string(), z.date()]).optional(),
})

// ---------------------------------------------------------------------------
// Factory functions — collections are created AFTER memberships load so that
// membership-derived IDs can be baked into the shape URLs. This eliminates
// the per-poll membership table scan on the server side.
// ---------------------------------------------------------------------------

const PROJECTS_SCHEMA_VERSION = 3

function _makeProjectsCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
  memberProjectIds: string[],
) {
  const url = new URL(`/api/projects`, apiUrl)
  if (memberProjectIds.length > 0) {
    url.searchParams.set(`member_ids`, memberProjectIds.join(`,`))
  }
  return createCollection(
    persistedCollectionOptions({
      ...electricCollectionOptions({
        id: `projects`,
        shapeOptions: {
          url: url.toString(),
          fetchClient: cookieFetch,
          onError: retryOnError,
          parser,
        },
        schema: selectProjectSchema,
        getKey: (item) => item.id,
        gcTime: NEVER_GC,
        // onInsert removed — routed through @tanstack/offline-transactions
        // (see application/actions/projects.ts → createProjectAction).
        onUpdate: async ({ transaction }) => {
          const { modified: p } = transaction.mutations[0]
          const result = await trpc.projects.update.mutate({
            id: p.id,
            data: { name: p.name, description: p.description },
          })
          return { txid: result.txid }
        },
        onDelete: async ({ transaction }) => {
          const { original: p } = transaction.mutations[0]
          const result = await trpc.projects.delete.mutate({ id: p.id })
          return { txid: result.txid }
        },
      }),
      persistence,
      schemaVersion: PROJECTS_SCHEMA_VERSION,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
}

const BUILD_UNITS_SCHEMA_VERSION = 3

function _makeBuildUnitsCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
  memberBuildunitIds: string[],
) {
  const url = new URL(`/api/buildunits`, apiUrl)
  if (memberBuildunitIds.length > 0) {
    url.searchParams.set(`member_ids`, memberBuildunitIds.join(`,`))
  }
  return createCollection(
    persistedCollectionOptions({
      ...electricCollectionOptions({
        id: `build-units`,
        shapeOptions: {
          url: url.toString(),
          fetchClient: cookieFetch,
          onError: retryOnError,
          parser,
        },
        schema: selectBuildUnitSchema,
        getKey: (item) => item.id,
        gcTime: NEVER_GC,
        // onInsert/onUpdate/onDelete removed — routed through
        // @tanstack/offline-transactions (see application/actions/buildunits.ts).
      }),
      persistence,
      schemaVersion: BUILD_UNITS_SCHEMA_VERSION,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
}

const CHANNELS_SCHEMA_VERSION = 3

function _makeChannelsCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
  memberChannelIds: string[],
) {
  const url = new URL(`/api/channels`, apiUrl)
  if (memberChannelIds.length > 0) {
    url.searchParams.set(`member_ids`, memberChannelIds.join(`,`))
  }
  return createCollection(
    persistedCollectionOptions({
      ...electricCollectionOptions({
        id: `channels`,
        shapeOptions: {
          url: url.toString(),
          fetchClient: cookieFetch,
          onError: retryOnError,
          parser,
        },
        schema: selectChannelSchema,
        getKey: (item) => item.id,
        gcTime: NEVER_GC,
        // onInsert/onUpdate/onDelete removed — routed through
        // @tanstack/offline-transactions (see application/actions/channels.ts).
      }),
      persistence,
      schemaVersion: CHANNELS_SCHEMA_VERSION,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
}

const CHANNEL_MEMBERS_SCHEMA_VERSION = 3

/**
 * The ROSTER stream: every member of every channel this user can see.
 *
 * This is NOT membershipsCollection. That one is the SELF stream — the server
 * scopes it `user_id = me`, so it holds only your own rows and can never tell you
 * who else is in a channel. Anything that renders other people (the assignee
 * picker, member lists) needs this collection instead. Mirrors web's
 * channelMembersCollection; both hit the same `memberships` table with a wider
 * where clause.
 *
 * The channel ids are baked into the shape URL, so this must be rebuilt whenever
 * the visible channel set changes — same lifecycle as channelsCollection, which is
 * why it lives here and not in admin.ts alongside the self stream.
 */
function _makeChannelMembersCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
  memberChannelIds: string[],
) {
  const url = new URL(`/api/channel-members`, apiUrl)
  // Note the param name: this route takes `channel_ids`, not the `member_ids` the
  // projects/buildunits/channels routes take.
  if (memberChannelIds.length > 0) {
    url.searchParams.set(`channel_ids`, memberChannelIds.join(`,`))
  }
  return createCollection(
    persistedCollectionOptions({
      ...electricCollectionOptions({
        id: `channel-members`,
        shapeOptions: {
          url: url.toString(),
          fetchClient: cookieFetch,
          onError: retryOnError,
          parser,
        },
        schema: electricMembershipSchema,
        getKey: (item) => item.id,
        gcTime: NEVER_GC,
      }),
      persistence,
      schemaVersion: CHANNEL_MEMBERS_SCHEMA_VERSION,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
}

// ---------------------------------------------------------------------------
// Deferred exports — initialized by initializeOrganizationCollections()
// after memberships preload.
// ---------------------------------------------------------------------------
export let projectsCollection: ReturnType<typeof _makeProjectsCollection> = null!
export let buildUnitsCollection: ReturnType<typeof _makeBuildUnitsCollection> = null!
export let channelsCollection: ReturnType<typeof _makeChannelsCollection> = null!
export let channelMembersCollection: ReturnType<typeof _makeChannelMembersCollection> = null!

// Standalone init for the projects collection — called during bootstrap
// (before a project is selected) so the picker can render all user projects.
export function initializeProjectsCollection(memberProjectIds: string[] = []) {
  if (projectsCollection) return
  const { persistence } = getPersistence()
  projectsCollection = _makeProjectsCollection(persistence, memberProjectIds)
}

export function initializeOrganizationCollections(params: {
  memberProjectIds: string[]
  memberBuildunitIds: string[]
  memberChannelIds: string[]
}) {
  const { persistence } = getPersistence()
  // Projects may already be initialized by bootstrap — only create if missing
  if (!projectsCollection) {
    projectsCollection = _makeProjectsCollection(persistence, params.memberProjectIds)
  }
  // On a project switch these hold the previous project's collections; stop
  // their sync before replacing (GC is disabled, so it won't happen for us).
  safeCleanup(buildUnitsCollection)
  safeCleanup(channelsCollection)
  buildUnitsCollection = _makeBuildUnitsCollection(persistence, params.memberBuildunitIds)
  channelsCollection = _makeChannelsCollection(persistence, params.memberChannelIds)
  initializeChannelMembersCollection(params.memberChannelIds)
}

/**
 * Create (or recreate) the roster collection for a channel-id set.
 *
 * Deliberately NOT folded into reinitializeScopedOrganizationCollections, which
 * only runs when the non-owner visibility set changes. `/api/channel-members` has
 * no owner escape hatch — its where clause is a bare `channel_id = ANY(...)` — so
 * a channel you own and created yourself flips channelKey without flipping
 * visibilityKey, and the roster would silently miss its members. It rebuilds on
 * EITHER key changing, like properties.
 */
export function initializeChannelMembersCollection(memberChannelIds: string[]) {
  const { persistence } = getPersistence()
  safeCleanup(channelMembersCollection)
  channelMembersCollection = _makeChannelMembersCollection(persistence, memberChannelIds)
}

// Rebuild ONLY the projects collection with a fresh (global) member-project id
// set. Used by resyncProjectCollections when the user's visible project list
// changes at runtime. Stops the previous instance's sync before replacing it.
export function reinitializeProjectsCollection(memberProjectIds: string[]) {
  const { persistence } = getPersistence()
  safeCleanup(projectsCollection)
  projectsCollection = _makeProjectsCollection(persistence, memberProjectIds)
}

// Rebuild the build-units + channels collections for the currently-selected
// project with a fresh (scoped) member-id set. Used by resyncProjectCollections
// when the user's visible build-unit/channel set changes at runtime. Stops the
// previous instances' sync before replacing them.
export function reinitializeScopedOrganizationCollections(params: {
  memberBuildunitIds: string[]
  memberChannelIds: string[]
}) {
  const { persistence } = getPersistence()
  safeCleanup(buildUnitsCollection)
  safeCleanup(channelsCollection)
  buildUnitsCollection = _makeBuildUnitsCollection(persistence, params.memberBuildunitIds)
  channelsCollection = _makeChannelsCollection(persistence, params.memberChannelIds)
}

export function resetOrganizationCollections() {
  // Stop sync before dropping the references (GC won't do it — it's disabled).
  safeCleanup(projectsCollection)
  safeCleanup(buildUnitsCollection)
  safeCleanup(channelsCollection)
  safeCleanup(channelMembersCollection)
  projectsCollection = null!
  buildUnitsCollection = null!
  channelsCollection = null!
  channelMembersCollection = null!
}
