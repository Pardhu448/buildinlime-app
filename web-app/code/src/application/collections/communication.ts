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
import { getPersistence } from "../../infrastructure/persistence/browser-persistence"
import { defineCollection } from "./_shared"

// The descriptors (id, route, shape params, row schema, key, GC tier) live once
// in @buildinlime/sync-core — see collection-specs.ts, which also carries the
// reasoning for each GC tier. This file supplies only web's persistence handle;
// none of these collections take handlers (writes go through
// @tanstack/offline-transactions — see application/actions/*).

/**
 * The seen_state collection's key. Re-exported because the optimistic upsert in
 * actions/seen.ts must look up an existing row before deciding insert-vs-update,
 * and a key built differently there would silently miss.
 */
export { seenKey }

// ---------------------------------------------------------------------------
// Factory functions — collections are created AFTER memberships load so that
// membership-derived IDs can be baked into the shape URLs.
// ---------------------------------------------------------------------------

function _makeTasksCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
  memberChannelIds: string[],
) {
  return defineCollection({ ...tasksSpec(memberChannelIds), persistence })
}

function _makeResourcesCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
  memberChannelIds: string[],
) {
  return defineCollection({ ...resourcesSpec(memberChannelIds), persistence })
}

function _makePropertiesCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
  params: {
    memberProjectIds: string[]
    memberBuildunitIds: string[]
    memberChannelIds: string[]
  },
) {
  return defineCollection({ ...propertiesSpec(params), persistence })
}

function _makeMessagesCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
  memberChannelIds: string[],
) {
  return defineCollection({ ...messagesSpec(memberChannelIds), persistence })
}

function _makeSeenStateCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
) {
  return defineCollection({ ...seenStateSpec(), persistence })
}

function _makeInboxMentionsCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
  memberChannelIds: string[],
) {
  return defineCollection({ ...inboxMentionsSpec(memberChannelIds), persistence })
}

function _makeMyTasksCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
  memberChannelIds: string[],
) {
  return defineCollection({ ...myTasksSpec(memberChannelIds), persistence })
}

// ---------------------------------------------------------------------------
// Deferred exports — initialized by initializeCommunicationCollections()
// called from the _authenticated loader after memberships preload.
// ---------------------------------------------------------------------------
export let tasksCollection: ReturnType<typeof _makeTasksCollection> = null!
export let inboxMentionsCollection: ReturnType<typeof _makeInboxMentionsCollection> = null!
export let myTasksCollection: ReturnType<typeof _makeMyTasksCollection> = null!
export let resourcesCollection: ReturnType<typeof _makeResourcesCollection> = null!
export let propertiesCollection: ReturnType<typeof _makePropertiesCollection> = null!
export let messagesCollection: ReturnType<typeof _makeMessagesCollection> = null!
export let seenStateCollection: ReturnType<typeof _makeSeenStateCollection> = null!

export async function initializeCommunicationCollections(params: {
  memberChannelIds: string[]
}) {
  if (import.meta.env.DEV) console.log(`[OPFS:comm] Initializing persisted collections…`)
  const t0 = performance.now()
  const { persistence } = await getPersistence()
  tasksCollection = _makeTasksCollection(persistence, params.memberChannelIds)
  messagesCollection = _makeMessagesCollection(persistence, params.memberChannelIds)
  resourcesCollection = _makeResourcesCollection(persistence, params.memberChannelIds)
  inboxMentionsCollection = _makeInboxMentionsCollection(persistence, params.memberChannelIds)
  myTasksCollection = _makeMyTasksCollection(persistence, params.memberChannelIds)
  // Seen markers are scoped `user_id = me` server-side, not by membership, so
  // this is built once and deliberately NOT rebuilt on a membership resync
  // (which re-enters this function) — rebuilding would orphan the live instance
  // for no gain.
  if (!seenStateCollection) seenStateCollection = _makeSeenStateCollection(persistence)
  if (import.meta.env.DEV) console.log(`[OPFS:comm] Collections created in ${(performance.now() - t0).toFixed(0)}ms`)
}

// Properties sync by membership id sets only (project/build-unit via entity_id,
// channel/task via the denormalized channel_id), so there is no longer a task-id
// dependency — this can init alongside the other collections.
export async function initializePropertiesCollection(params: {
  memberProjectIds: string[]
  memberBuildunitIds: string[]
  memberChannelIds: string[]
}) {
  const { persistence } = await getPersistence()
  propertiesCollection = _makePropertiesCollection(persistence, params)
}
