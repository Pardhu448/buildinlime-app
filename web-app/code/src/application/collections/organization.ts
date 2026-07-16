import {
  projectRowSchema,
  buildUnitRowSchema,
  channelRowSchema,
  membershipRowSchema,
} from "@buildinlime/contracts"
import { trpc } from "%/infrastructure/trpc/lib/trpc-client"
import { getPersistence } from "../../infrastructure/persistence/browser-persistence"
import { defineCollection, retryOnMembershipsError, NEVER_GC } from "./_shared"

// Row schemas come from @buildinlime/contracts — one copy, shared with mobile and
// asserted against the drizzle tables server-side. See ARCHITECTURE.md §10.

function _makeMembershipsCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
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
// Channel-members (roster) collection — a read-only view of every active
// membership for the channels the user can see. Shares the memberships table
// and schema with the self stream above, but syncs a DIFFERENT Electric shape
// (/api/channel-members, filtered by baked channel_ids derived from the
// already-synced self-membership rows). Used only for roster display
// (member lists, add/remove UI, assignee pickers). No mutation handlers — the
// membership table is written via the channels tRPC router. Recreated by the
// membership-change trigger when the visible channel set changes (Phase 4).
// ---------------------------------------------------------------------------

function _makeChannelMembersCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
  channelIds: string[],
) {
  return defineCollection({
    id: `channel-members`,
    path: `/api/channel-members`,
    // Note the param name: this route takes `channel_ids`, not the `member_ids` the
    // projects/buildunits/channels routes take.
    params: { channel_ids: channelIds },
    schema: membershipRowSchema,
    getKey: (item: { id: string }) => item.id,
    gcTime: NEVER_GC,
    persistence,
  })
}

// Deferred export — initialized by initializeChannelMembersCollection().
export let channelMembersCollection: ReturnType<typeof _makeChannelMembersCollection> = null!

export async function initializeChannelMembersCollection(params: { channelIds: string[] }) {
  if (import.meta.env.DEV) console.log(`[OPFS:channel-members] Initializing persisted collection…`)
  const t0 = performance.now()
  const { persistence } = await getPersistence()
  channelMembersCollection = _makeChannelMembersCollection(persistence, params.channelIds)
  if (import.meta.env.DEV) console.log(`[OPFS:channel-members] Collection created in ${(performance.now() - t0).toFixed(0)}ms`)
}

// ---------------------------------------------------------------------------
// Factory functions — collections are created AFTER memberships load so that
// membership-derived IDs can be baked into the shape URLs.  This eliminates
// the per-poll membership table scan on the server side.
// ---------------------------------------------------------------------------

function _makeProjectsCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
  memberProjectIds: string[],
) {
  return defineCollection({
    id: `projects`,
    path: `/api/projects`,
    params: { member_ids: memberProjectIds },
    schema: projectRowSchema,
    getKey: (item: { id: string }) => item.id,
    gcTime: NEVER_GC,
    persistence,
    handlers: {
      onInsert: async ({ transaction }: { transaction: { mutations: { modified: { id: string; name: string; description?: string | null; owner_id: string } }[] } }) => {
        const { modified: newProject } = transaction.mutations[0]
        const result = await trpc.projects.create.mutate({
          id: newProject.id,
          name: newProject.name,
          description: newProject.description,
          owner_id: newProject.owner_id,
        })

        return { txid: result.txid }
      },
      onUpdate: async ({ transaction }: { transaction: { mutations: { modified: { id: string; name: string; description?: string | null } }[] } }) => {
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
      onDelete: async ({ transaction }: { transaction: { mutations: { original: { id: string } }[] } }) => {
        const { original: deletedProject } = transaction.mutations[0]
        const result = await trpc.projects.delete.mutate({
          id: deletedProject.id,
        })

        return { txid: result.txid }
      },
    },
  })
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

function _makeBuildUnitsCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
  memberBuildunitIds: string[],
) {
  return defineCollection({
    id: `build-units`,
    path: `/api/buildunits`,
    params: { member_ids: memberBuildunitIds },
    schema: buildUnitRowSchema,
    getKey: (item: { id: string }) => item.id,
    gcTime: NEVER_GC,
    persistence,
    handlers: {
      onInsert: async ({ transaction }: { transaction: { mutations: { modified: { id: string; name: string; description?: string | null; project_id: string; owner_id: string } }[] } }) => {
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
      onUpdate: async ({ transaction }: { transaction: { mutations: { modified: { id: string; name: string; description?: string | null } }[] } }) => {
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
      onDelete: async ({ transaction }: { transaction: { mutations: { original: { id: string } }[] } }) => {
        const { original: deletedBuildUnit } = transaction.mutations[0]
        const result = await trpc.buildUnits.delete.mutate({
          id: deletedBuildUnit.id,
        })

        return { txid: result.txid }
      },
    },
  })
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

function _makeChannelsCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
  memberChannelIds: string[],
) {
  return defineCollection({
    id: `channels`,
    path: `/api/channels`,
    params: { member_ids: memberChannelIds },
    schema: channelRowSchema,
    getKey: (item: { id: string }) => item.id,
    gcTime: NEVER_GC,
    persistence,
    handlers: {
      onInsert: async ({ transaction }: { transaction: { mutations: { modified: { id: string; name: never; description?: string | null; buildunit_id: string; owner_id: string } }[] } }) => {
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
      onUpdate: async ({ transaction }: { transaction: { mutations: { modified: { id: string; name: never; description?: string | null } }[] } }) => {
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
      onDelete: async ({ transaction }: { transaction: { mutations: { original: { id: string } }[] } }) => {
        const { original: deletedChannel } = transaction.mutations[0]
        const result = await trpc.channels.delete.mutate({
          id: deletedChannel.id,
        })

        return { txid: result.txid }
      },
    },
  })
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
