import { createCollection } from "@tanstack/react-db"
import { electricCollectionOptions } from "@tanstack/electric-db-collection"
import { persistedCollectionOptions } from "@tanstack/browser-db-sqlite-persistence"
import { z } from "zod"
import {
  selectProjectSchema,
  selectBuildUnitSchema,
  selectChannelSchema,
  selectMembershipSchema,
  MEMBERSHIP_ROLES,
} from "%/infrastructure/database/schema/admin-schema"
import { trpc } from "%/infrastructure/trpc/lib/trpc-client"
import { getPersistence } from "../../infrastructure/persistence/browser-persistence"
import { retryOnError, coerceBool, origin } from "./_shared"

const electricMembershipSchema = selectMembershipSchema.extend({
  member_flag: z.preprocess(coerceBool, z.boolean()),
  role: z.enum(MEMBERSHIP_ROLES).default(`viewer`),
})

const MEMBERSHIPS_SCHEMA_VERSION = 1

function _makeMembershipsCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
) {
  return createCollection(
    persistedCollectionOptions({
      ...electricCollectionOptions({
        id: `memberships`,
        shapeOptions: {
          url: new URL(`/api/memberships`, origin).toString(),
          onError: retryOnError,
          parser: {
            timestamptz: (date: string) => new Date(date),
          },
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

// Deferred export — initialized by initializeMembershipsCollection()
export let membershipsCollection: ReturnType<typeof _makeMembershipsCollection> = null!

export async function initializeMembershipsCollection() {
  if (import.meta.env.DEV) console.log(`[OPFS:memberships] Initializing persisted collection…`)
  const t0 = performance.now()
  const { persistence } = await getPersistence()
  membershipsCollection = _makeMembershipsCollection(persistence)
  if (import.meta.env.DEV) console.log(`[OPFS:memberships] Collection created in ${(performance.now() - t0).toFixed(0)}ms`)
}

// ---------------------------------------------------------------------------
// Factory functions — collections are created AFTER memberships load so that
// membership-derived IDs can be baked into the shape URLs.  This eliminates
// the per-poll membership table scan on the server side.
// ---------------------------------------------------------------------------

const PROJECTS_SCHEMA_VERSION = 1

function _makeProjectsCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
  memberProjectIds: string[],
) {
  const url = new URL(`/api/projects`, origin)
  if (memberProjectIds.length > 0) url.searchParams.set(`member_ids`, memberProjectIds.join(`,`))
  return createCollection(
    persistedCollectionOptions({
      ...electricCollectionOptions({
        id: `projects`,
        shapeOptions: {
          url: url.toString(),
          onError: retryOnError,
          parser: {
            timestamptz: (date: string) => {
              return new Date(date)
            },
          },
        },
        schema: selectProjectSchema,
        getKey: (item) => item.id,
        onInsert: async ({ transaction }) => {
          const { modified: newProject } = transaction.mutations[0]
          const result = await trpc.projects.create.mutate({
            id: newProject.id,
            name: newProject.name,
            description: newProject.description,
            owner_id: newProject.owner_id,
          })

          return { txid: result.txid }
        },
        onUpdate: async ({ transaction }) => {
          const { modified: updatedProject } = transaction.mutations[0]
          const result = await trpc.projects.update.mutate({
            id: updatedProject.id,
            data: {
              name: updatedProject.name,
              description: updatedProject.description,
            },
          })

          return { txid: result.txid }
        },
        onDelete: async ({ transaction }) => {
          const { original: deletedProject } = transaction.mutations[0]
          const result = await trpc.projects.delete.mutate({
            id: deletedProject.id,
          })

          return { txid: result.txid }
        },
      }),
      persistence,
      schemaVersion: PROJECTS_SCHEMA_VERSION,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
}

// Registry allowing UI components to be notified when a build unit insert
// completes (success or error) via the onInsert handler below.
type InsertCallback = { resolve: () => void; reject: (err: Error) => void }
const _buildUnitInsertCallbacks = new Map<string, InsertCallback>()

export function registerBuildUnitInsertCallback(
  id: string,
  resolve: () => void,
  reject: (err: Error) => void,
) {
  _buildUnitInsertCallbacks.set(id, { resolve, reject })
}

const BUILD_UNITS_SCHEMA_VERSION = 1

function _makeBuildUnitsCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
  memberBuildunitIds: string[],
) {
  const url = new URL(`/api/buildunits`, origin)
  if (memberBuildunitIds.length > 0) url.searchParams.set(`member_ids`, memberBuildunitIds.join(`,`))
  return createCollection(
    persistedCollectionOptions({
      ...electricCollectionOptions({
        id: `build-units`,
        shapeOptions: {
          url: url.toString(),
          onError: retryOnError,
          parser: {
            timestamptz: (date: string) => {
              return new Date(date)
            },
          },
        },
        schema: selectBuildUnitSchema,
        getKey: (item) => item.id,
        onInsert: async ({ transaction }) => {
          const { modified: newBuildUnit } = transaction.mutations[0]
          try {
            const result = await trpc.buildUnits.create.mutate({
              id: newBuildUnit.id,
              name: newBuildUnit.name,
              description: newBuildUnit.description,
              project_id: newBuildUnit.project_id,
              owner_id: newBuildUnit.owner_id,
            })
            _buildUnitInsertCallbacks.get(newBuildUnit.id)?.resolve()
            _buildUnitInsertCallbacks.delete(newBuildUnit.id)
            return { txid: result.txid }
          } catch (err) {
            _buildUnitInsertCallbacks.get(newBuildUnit.id)?.reject(err instanceof Error ? err : new Error(String(err)))
            _buildUnitInsertCallbacks.delete(newBuildUnit.id)
            throw err
          }
        },
        onUpdate: async ({ transaction }) => {
          const { modified: updatedBuildUnit } = transaction.mutations[0]
          const result = await trpc.buildUnits.update.mutate({
            id: updatedBuildUnit.id,
            data: {
              name: updatedBuildUnit.name,
              description: updatedBuildUnit.description,
            },
          })

          return { txid: result.txid }
        },
        onDelete: async ({ transaction }) => {
          const { original: deletedBuildUnit } = transaction.mutations[0]
          const result = await trpc.buildUnits.delete.mutate({
            id: deletedBuildUnit.id,
          })

          return { txid: result.txid }
        },
      }),
      persistence,
      schemaVersion: BUILD_UNITS_SCHEMA_VERSION,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
}

// Registry allowing UI components to be notified when a channel insert
// completes (success or error) via the onInsert handler below.
type ChannelInsertCallback = { resolve: () => void; reject: (err: Error) => void }
const _channelInsertCallbacks = new Map<string, ChannelInsertCallback>()

export function registerChannelInsertCallback(
  id: string,
  resolve: () => void,
  reject: (err: Error) => void,
) {
  _channelInsertCallbacks.set(id, { resolve, reject })
}

const CHANNELS_SCHEMA_VERSION = 1

function _makeChannelsCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
  memberChannelIds: string[],
) {
  const url = new URL(`/api/channels`, origin)
  if (memberChannelIds.length > 0) url.searchParams.set(`member_ids`, memberChannelIds.join(`,`))
  return createCollection(
    persistedCollectionOptions({
      ...electricCollectionOptions({
        id: `channels`,
        shapeOptions: {
          url: url.toString(),
          onError: retryOnError,
          parser: {
            timestamptz: (date: string) => {
              return new Date(date)
            },
          },
        },
        schema: selectChannelSchema,
        getKey: (item) => item.id,
        onInsert: async ({ transaction }) => {
          const { modified: newChannel } = transaction.mutations[0]
          try {
            const result = await trpc.channels.create.mutate({
              id: newChannel.id,
              name: newChannel.name,
              description: newChannel.description,
              buildunit_id: newChannel.buildunit_id,
              owner_id: newChannel.owner_id,
            })
            _channelInsertCallbacks.get(newChannel.id)?.resolve()
            _channelInsertCallbacks.delete(newChannel.id)
            return { txid: result.txid }
          } catch (err) {
            _channelInsertCallbacks.get(newChannel.id)?.reject(err instanceof Error ? err : new Error(String(err)))
            _channelInsertCallbacks.delete(newChannel.id)
            throw err
          }
        },
        onUpdate: async ({ transaction }) => {
          const { modified: updatedChannel } = transaction.mutations[0]
          const result = await trpc.channels.update.mutate({
            id: updatedChannel.id,
            data: {
              name: updatedChannel.name,
              description: updatedChannel.description,
            },
          })

          return { txid: result.txid }
        },
        onDelete: async ({ transaction }) => {
          const { original: deletedChannel } = transaction.mutations[0]
          const result = await trpc.channels.delete.mutate({
            id: deletedChannel.id,
          })

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
// called from the _authenticated loader after memberships preload.
// ES-module live bindings ensure importers always read the current value.
// ---------------------------------------------------------------------------
export let projectsCollection: ReturnType<typeof _makeProjectsCollection> = null!
export let buildUnitsCollection: ReturnType<typeof _makeBuildUnitsCollection> = null!
export let channelsCollection: ReturnType<typeof _makeChannelsCollection> = null!

export async function initializeOrganizationCollections(params: {
  memberProjectIds: string[]
  memberBuildunitIds: string[]
  memberChannelIds: string[]
}) {
  if (import.meta.env.DEV) console.log(`[OPFS:org] Initializing persisted collections (projects, buildUnits, channels)…`)
  const t0 = performance.now()
  const { persistence } = await getPersistence()
  projectsCollection = _makeProjectsCollection(persistence, params.memberProjectIds)
  buildUnitsCollection = _makeBuildUnitsCollection(persistence, params.memberBuildunitIds)
  channelsCollection = _makeChannelsCollection(persistence, params.memberChannelIds)
  if (import.meta.env.DEV) console.log(`[OPFS:org] Collections created in ${(performance.now() - t0).toFixed(0)}ms`)
}
