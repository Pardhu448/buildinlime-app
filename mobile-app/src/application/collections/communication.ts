import {
  taskRowSchema,
  messageRowSchema,
  resourceRowSchema,
  propertyRowSchema,
  seenStateRowSchema,
} from "@buildinlime/contracts"
import { trpc } from "../../infrastructure/trpc/client"
import { getPersistence } from "../../infrastructure/persistence/expo-persistence"
import { defineCollection, NEVER_GC, IDLE_GC_MS, safeCleanup } from "./_shared"

// Row schemas come from @buildinlime/contracts — one copy, shared with web and
// asserted against the drizzle tables server-side. See ARCHITECTURE.md §10.
//
// Zod strips unknown keys, so a column missing from a row schema is DROPPED from
// the synced row rather than merely untyped. That is why the schemas are no longer
// maintained here by hand: this file had already lost properties.channel_id and
// properties.createdby_id that way.

// ---------------------------------------------------------------------------
// Factory functions — collections are created AFTER memberships load so that
// membership-derived IDs can be baked into the shape URLs.
// ---------------------------------------------------------------------------

function _makeTasksCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
  memberChannelIds: string[],
) {
  return defineCollection({
    id: `tasks`,
    path: `/api/tasks`,
    params: { member_channel_ids: memberChannelIds },
    schema: taskRowSchema,
    getKey: (item: { id: string }) => item.id,
    // Idle-GC: with the DrawerContent My-Tasks badge now reading the tiny
    // my-tasks slice (not scanning this full collection), nothing
    // always-mounted holds tasks. It idles on the drawer / home / inbox
    // screens and resurrects + resumes from the SQLite offset when a channel /
    // My-Tasks view opens. See IDLE_GC_MS.
    gcTime: IDLE_GC_MS,
    persistence,
    // No handlers — writes routed through @tanstack/offline-transactions
    // (see application/actions/tasks.ts).
  })
}

function _makeMessagesCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
  memberChannelIds: string[],
) {
  return defineCollection({
    id: `messages`,
    path: `/api/messages`,
    params: { member_channel_ids: memberChannelIds },
    schema: messageRowSchema,
    getKey: (item: { id: string }) => item.id,
    // Idle-GC: with the DrawerContent inbox badge now reading the tiny
    // inbox-mentions slice (not scanning this full collection), nothing
    // always-mounted holds messages. It idles off the channel / inbox screens
    // and resurrects + resumes from the SQLite offset on return. See IDLE_GC_MS.
    gcTime: IDLE_GC_MS,
    persistence,
    // No handlers. onInsert is routed through @tanstack/offline-transactions
    // (see application/actions/messages.ts → createMessageAction), and onDelete is
    // omitted DELIBERATELY: deleting a message is a soft delete, which is an UPDATE
    // (the row survives so its replies keep a parent) — see deleteMessageAction. A
    // delete handler here would let messagesCollection.delete() drop the row
    // optimistically and orphan the thread. With none it fails loudly instead.
  })
}

function _makeResourcesCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
  memberChannelIds: string[],
) {
  return defineCollection({
    id: `resources`,
    path: `/api/resources`,
    params: { member_channel_ids: memberChannelIds },
    schema: resourceRowSchema,
    getKey: (item: { id: string }) => item.id,
    // Idle-GC: resources has NO always-mounted subscriber (only the
    // ResourcesSheet and in-message attachment views, both mounted on
    // demand), so it idles off-screen. Persisted, so resurrection resumes from
    // the SQLite offset rather than refetching. See IDLE_GC_MS.
    gcTime: IDLE_GC_MS,
    persistence,
    // No handlers — onDelete routed through @tanstack/offline-transactions
    // (see application/actions/resources.ts → deleteResourceAction).
  })
}

function _makePropertiesCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
  params: {
    memberProjectIds: string[]
    memberBuildunitIds: string[]
    memberChannelIds: string[]
  },
) {
  return defineCollection({
    id: `properties`,
    path: `/api/properties`,
    // The /api/properties shape OR's two scopes: project/build-unit properties by
    // entity_id (member_project_ids ∪ member_buildunit_ids), and channel + TASK
    // properties by the denormalized channel_id (member_channel_ids). Task
    // properties therefore ride the same channel scope as tasks/messages — a new
    // task's properties in a visible channel sync with no rebuild, so no
    // member_task_ids snapshot is needed (server ignores it).
    params: {
      member_project_ids: params.memberProjectIds,
      member_buildunit_ids: params.memberBuildunitIds,
      member_channel_ids: params.memberChannelIds,
    },
    schema: propertyRowSchema,
    getKey: (item: { id: string }) => item.id,
    // Idle-GC: properties is subscribed ONLY by the channel / build-unit /
    // task screens — nothing always-mounted holds it (the Drawer badges scan
    // messages/tasks/seen_state, never properties). Persisted, so the next visit
    // resurrects it and resumes from the SQLite offset. See IDLE_GC_MS.
    gcTime: IDLE_GC_MS,
    persistence,
    handlers: {
      // onInsert/onDelete omitted — routed through @tanstack/offline-transactions
      // (see application/actions/properties.ts).
      onUpdate: async ({ transaction }: {
        transaction: {
          mutations: {
            modified: {
              id: string
              status_value?: string | null
              priority_value?: string | null
              target_date?: string | Date | null
              start_date?: string | Date | null
              pending_task?: string | null
            }
          }[]
        }
      }) => {
        const { modified: p } = transaction.mutations[0]
        const result = await trpc.properties.update.mutate({
          id: p.id,
          data: {
            status_value: p.status_value as never,
            priority_value: p.priority_value as never,
            // The collection row widens these text columns to string | Date;
            // the wire contract is string. They hold ISO strings at runtime.
            target_date: p.target_date as string | null | undefined,
            start_date: p.start_date as string | null | undefined,
            pending_task: p.pending_task,
          },
        })
        return { txid: result.txid }
      },
    },
  })
}

// ---------------------------------------------------------------------------
// Badge slices — user-scoped subsets that exist so the ALWAYS-MOUNTED
// DrawerContent inbox / my-tasks badges don't have to hold the full
// channel-scoped messages / tasks collections open for the whole session just to
// count the few rows that concern the current user. The server does the mention /
// assignee filter (web-app routes/api/inbox-mentions.ts and api/my-tasks.ts); the
// badge subscribes to these tiny shapes, and the full collections are freed to
// idle-GC. NEVER_GC — these ARE the always-mounted subscription. Read-only: no
// mutation handlers (messages/tasks are written via their full collections).
// Channel-scoped, so they rebuild with the other channel-scoped collections on a
// membership resync.
// ---------------------------------------------------------------------------

function _makeInboxMentionsCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
  memberChannelIds: string[],
) {
  return defineCollection({
    id: `inbox-mentions`,
    path: `/api/inbox-mentions`,
    params: { member_channel_ids: memberChannelIds },
    schema: messageRowSchema,
    getKey: (item: { id: string }) => item.id,
    gcTime: NEVER_GC,
    persistence,
  })
}

function _makeMyTasksCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
  memberChannelIds: string[],
) {
  return defineCollection({
    id: `my-tasks`,
    path: `/api/my-tasks`,
    params: { member_channel_ids: memberChannelIds },
    schema: taskRowSchema,
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

// ---------------------------------------------------------------------------
// Deferred exports — initialized by initializeCommunicationCollections()
// and initializePropertiesCollection() after memberships and tasks preload.
// ---------------------------------------------------------------------------
export let seenStateCollection: ReturnType<typeof _makeSeenStateCollection> = null!
export let tasksCollection: ReturnType<typeof _makeTasksCollection> = null!
export let messagesCollection: ReturnType<typeof _makeMessagesCollection> = null!
export let resourcesCollection: ReturnType<typeof _makeResourcesCollection> = null!
export let propertiesCollection: ReturnType<typeof _makePropertiesCollection> = null!
export let inboxMentionsCollection: ReturnType<typeof _makeInboxMentionsCollection> = null!
export let myTasksCollection: ReturnType<typeof _makeMyTasksCollection> = null!

// Seen state is scoped `user_id = me` server-side, not by membership, so it is
// initialized during BOOTSTRAP alongside users — not with the channel-scoped
// collections below, and it never rebuilds on a scope change.
export function initializeSeenStateCollection() {
  const { persistence } = getPersistence()
  safeCleanup(seenStateCollection)
  seenStateCollection = _makeSeenStateCollection(persistence)
}

export function initializeCommunicationCollections(params: {
  memberChannelIds: string[]
}) {
  const { persistence } = getPersistence()
  // On a project switch / channel-set resync these hold the previous instances;
  // stop their sync before replacing (GC is disabled, so nothing else will).
  safeCleanup(tasksCollection)
  safeCleanup(messagesCollection)
  safeCleanup(resourcesCollection)
  safeCleanup(inboxMentionsCollection)
  safeCleanup(myTasksCollection)
  tasksCollection = _makeTasksCollection(persistence, params.memberChannelIds)
  messagesCollection = _makeMessagesCollection(persistence, params.memberChannelIds)
  resourcesCollection = _makeResourcesCollection(persistence, params.memberChannelIds)
  inboxMentionsCollection = _makeInboxMentionsCollection(persistence, params.memberChannelIds)
  myTasksCollection = _makeMyTasksCollection(persistence, params.memberChannelIds)
}

// Properties are scoped by entity_id (project/build-unit) and channel_id
// (channel/task) only — no task-id dependency — so this can init in parallel
// with the other channel-scoped collections (no need to wait for tasks).
export function initializePropertiesCollection(params: {
  memberProjectIds: string[]
  memberBuildunitIds: string[]
  memberChannelIds: string[]
}) {
  const { persistence } = getPersistence()
  safeCleanup(propertiesCollection)
  propertiesCollection = _makePropertiesCollection(persistence, params)
}

export function resetCommunicationCollections() {
  // Stop sync before dropping the references (GC won't do it — it's disabled).
  safeCleanup(seenStateCollection)
  seenStateCollection = null!
  safeCleanup(tasksCollection)
  safeCleanup(messagesCollection)
  safeCleanup(resourcesCollection)
  safeCleanup(propertiesCollection)
  safeCleanup(inboxMentionsCollection)
  safeCleanup(myTasksCollection)
  tasksCollection = null!
  messagesCollection = null!
  resourcesCollection = null!
  propertiesCollection = null!
  inboxMentionsCollection = null!
  myTasksCollection = null!
}
