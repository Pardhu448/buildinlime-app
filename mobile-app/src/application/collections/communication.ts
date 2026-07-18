import {
  tasksSpec,
  messagesSpec,
  resourcesSpec,
  propertiesSpec,
  seenStateSpec,
  inboxMentionsSpec,
  myTasksSpec,
  seenKey,
} from "@buildinlime/sync-core"
import { trpc } from "../../infrastructure/trpc/client"
import { getPersistence } from "../../infrastructure/persistence/expo-persistence"
import { defineCollection, safeCleanup } from "./_shared"

// The descriptors (id, route, shape params, row schema, key, GC tier) live once
// in @buildinlime/sync-core — see collection-specs.ts, which also carries the
// reasoning for each GC tier. This file supplies only what is mobile's own: the
// persistence handle, and the properties onUpdate handler.

// seenKey is re-exported because application/actions/seen.ts imports it from here.
export { seenKey }

// ---------------------------------------------------------------------------
// Factory functions — collections are created AFTER memberships load so that
// membership-derived IDs can be baked into the shape URLs.
// ---------------------------------------------------------------------------

function _makeTasksCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
  memberChannelIds: string[],
) {
  // No handlers — writes routed through @tanstack/offline-transactions
  // (see application/actions/tasks.ts).
  return defineCollection({ ...tasksSpec(memberChannelIds), persistence })
}

function _makeMessagesCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
  memberChannelIds: string[],
) {
  // No handlers. onInsert is routed through @tanstack/offline-transactions
  // (see application/actions/messages.ts → createMessageAction), and onDelete is
  // omitted DELIBERATELY: deleting a message is a soft delete, which is an UPDATE
  // (the row survives so its replies keep a parent) — see deleteMessageAction. A
  // delete handler here would let messagesCollection.delete() drop the row
  // optimistically and orphan the thread. With none it fails loudly instead.
  return defineCollection({ ...messagesSpec(memberChannelIds), persistence })
}

function _makeResourcesCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
  memberChannelIds: string[],
) {
  // No handlers — onDelete routed through @tanstack/offline-transactions
  // (see application/actions/resources.ts → deleteResourceAction).
  return defineCollection({ ...resourcesSpec(memberChannelIds), persistence })
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
    ...propertiesSpec(params),
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
  return defineCollection({ ...inboxMentionsSpec(memberChannelIds), persistence })
}

function _makeMyTasksCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
  memberChannelIds: string[],
) {
  return defineCollection({ ...myTasksSpec(memberChannelIds), persistence })
}

function _makeSeenStateCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
) {
  return defineCollection({ ...seenStateSpec(), persistence })
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
  // On a channel-set resync (resyncProjectCollections re-enters this function)
  // these hold the previous instances; stop their sync before replacing, since
  // GC is disabled and nothing else will. Unlike the organization equivalent,
  // this cleanup IS live — a membership change rebuilds the channel-scoped
  // collections mid-session.
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
