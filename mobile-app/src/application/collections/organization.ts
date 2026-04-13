import { createCollection } from "@tanstack/react-db"
import { electricCollectionOptions } from "@tanstack/electric-db-collection"
import { persistedCollectionOptions } from "@tanstack/expo-db-sqlite-persistence"
import { z } from "zod"
import { CHANNEL_NAMES } from "@buildinlime/domain-types"
import { trpc } from "../../infrastructure/trpc/client"
import { getPersistence } from "../../infrastructure/persistence/expo-persistence"
import { apiUrl, cookieFetch, retryOnError, unwrapJsonb, parser } from "./_shared"

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

const PROJECTS_SCHEMA_VERSION = 1

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
        onInsert: async ({ transaction }) => {
          const { modified: p } = transaction.mutations[0]
          const result = await trpc.projects.create.mutate({
            id: p.id,
            name: p.name,
            description: p.description,
            owner_id: p.owner_id,
          })
          return { txid: result.txid }
        },
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

const BUILD_UNITS_SCHEMA_VERSION = 1

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
        onInsert: async ({ transaction }) => {
          const { modified: b } = transaction.mutations[0]
          const result = await trpc.buildUnits.create.mutate({
            id: b.id,
            name: b.name,
            description: b.description,
            project_id: b.project_id,
            owner_id: b.owner_id,
          })
          return { txid: result.txid }
        },
        onUpdate: async ({ transaction }) => {
          const { modified: b } = transaction.mutations[0]
          const result = await trpc.buildUnits.update.mutate({
            id: b.id,
            data: { name: b.name, description: b.description },
          })
          return { txid: result.txid }
        },
        onDelete: async ({ transaction }) => {
          const { original: b } = transaction.mutations[0]
          const result = await trpc.buildUnits.delete.mutate({ id: b.id })
          return { txid: result.txid }
        },
      }),
      persistence,
      schemaVersion: BUILD_UNITS_SCHEMA_VERSION,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
}

const CHANNELS_SCHEMA_VERSION = 1

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
        onInsert: async ({ transaction }) => {
          const { modified: c } = transaction.mutations[0]
          const result = await trpc.channels.create.mutate({
            id: c.id,
            name: c.name,
            description: c.description,
            buildunit_id: c.buildunit_id,
            owner_id: c.owner_id,
          })
          return { txid: result.txid }
        },
        onUpdate: async ({ transaction }) => {
          const { modified: c } = transaction.mutations[0]
          const result = await trpc.channels.update.mutate({
            id: c.id,
            data: { name: c.name, description: c.description },
          })
          return { txid: result.txid }
        },
        onDelete: async ({ transaction }) => {
          const { original: c } = transaction.mutations[0]
          const result = await trpc.channels.delete.mutate({ id: c.id })
          return { txid: result.txid }
        },
      }),
      persistence,
      schemaVersion: CHANNELS_SCHEMA_VERSION,
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
  buildUnitsCollection = _makeBuildUnitsCollection(persistence, params.memberBuildunitIds)
  channelsCollection = _makeChannelsCollection(persistence, params.memberChannelIds)
}

export function resetOrganizationCollections() {
  projectsCollection = null!
  buildUnitsCollection = null!
  channelsCollection = null!
}
