import {
  taskRowSchema,
  messageRowSchema,
  resourceRowSchema,
  propertyRowSchema,
  seenStateRowSchema,
} from "@buildinlime/contracts"
import { getPersistence } from "../../infrastructure/persistence/browser-persistence"
import { defineCollection, NEVER_GC, IDLE_GC_MS } from "./_shared"

// Row schemas come from @buildinlime/contracts — one copy, shared with mobile and
// asserted against the drizzle tables server-side. See ARCHITECTURE.md §10.

// ---------------------------------------------------------------------------
// Factory functions — collections are created AFTER memberships load so that
// membership-derived IDs can be baked into the shape URLs.
// ---------------------------------------------------------------------------

function _makeTasksCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
  memberChannelIds: string[],
) {
  return defineCollection({
    id: `tasks`,
    path: `/api/tasks`,
    params: { member_channel_ids: memberChannelIds },
    schema: taskRowSchema,
    getKey: (item: { id: string }) => item.id,
    // Idle-GC: the always-mounted Sidebar "My Tasks" badge reads the
    // user-scoped myTasksCollection slice, and useSeen reads only seen_state
    // — so nothing always-mounted holds this full collection. Its only
    // subscribers are the channel/task views, so it idles (and closes its
    // shape stream) on the project list, Inbox and My-Tasks screens,
    // resurrecting + resuming from OPFS on the next visit.
    gcTime: IDLE_GC_MS,
    persistence,
    // No handlers — task writes go through @tanstack/offline-transactions (see
    // application/actions/tasks.ts). Direct collection.insert/update/delete calls
    // outside an offline transaction fail with "no handler", which is the intended
    // loud failure mode.
  })
}

function _makeResourcesCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
  memberChannelIds: string[],
) {
  return defineCollection({
    id: `resources`,
    path: `/api/resources`,
    params: { member_channel_ids: memberChannelIds },
    schema: resourceRowSchema,
    getKey: (item: { id: string }) => item.id,
    // Idle-GC (not NEVER_GC): resources is subscribed ONLY by the channel
    // Resources view and the message/task attachment sections — nothing
    // always-mounted holds it (the Sidebar and badges never touch it). The
    // shape carries metadata only; file bytes/thumbnails load from the
    // separate /api/resources/:id/file route, so GC'ing this collection
    // never affects a rendered thumbnail. Persisted, so the next Resources
    // visit resurrects it and resumes from the OPFS offset rather than
    // refetching. See IDLE_GC_MS.
    gcTime: IDLE_GC_MS,
    persistence,
    // No handlers — resource deletes go through @tanstack/offline-transactions
    // (see application/actions/resources.ts).
  })
}

function _makePropertiesCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
  params: {
    memberProjectIds: string[]
    memberBuildunitIds: string[]
    memberChannelIds: string[]
  },
) {
  return defineCollection({
    id: `properties`,
    path: `/api/properties`,
    params: {
      member_project_ids: params.memberProjectIds,
      member_buildunit_ids: params.memberBuildunitIds,
      member_channel_ids: params.memberChannelIds,
    },
    schema: propertyRowSchema,
    getKey: (item: { id: string }) => item.id,
    // Idle-GC (not NEVER_GC): properties is subscribed ONLY by the channel /
    // build-unit / task routes — nothing always-mounted holds it (verified:
    // the Sidebar and unread badges never touch it). So it idles on the
    // project list, Inbox and My-Tasks screens, and GC closes its shape
    // stream there. Persisted, so the next channel/task visit resurrects it
    // and resumes from the OPFS offset rather than refetching. See IDLE_GC_MS.
    gcTime: IDLE_GC_MS,
    persistence,
    // No handlers — property writes go through @tanstack/offline-transactions
    // (see application/actions/properties.ts: create / update / delete).
  })
}

function _makeMessagesCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
  memberChannelIds: string[],
) {
  return defineCollection({
    id: `messages`,
    path: `/api/messages`,
    params: { member_channel_ids: memberChannelIds },
    schema: messageRowSchema,
    getKey: (item: { id: string }) => item.id,
    // Idle-GC: with the Sidebar's per-channel unread pills removed, the
    // always-mounted inbox badge reading the inbox-mentions slice, and
    // useSeen reading only seen_state, nothing always-mounted holds this full
    // collection. It idles (and closes its shape stream) on the project list
    // / My-Tasks / Inbox screens, and resurrects + resumes from OPFS when a
    // channel or the Inbox view opens.
    gcTime: IDLE_GC_MS,
    persistence,
    // No handlers — message writes go through @tanstack/offline-transactions
    // (see application/actions/messages.ts). Delete is not currently used by UI;
    // add a mutationFn + action when needed.
  })
}

/**
 * The seen_state collection's key. Exported because the optimistic upsert in
 * actions/seen.ts must look up an existing row before deciding insert-vs-update,
 * and a key built differently there would silently miss.
 */
export const seenKey = (userId: string, scope: string, scopeId: string) =>
  `${userId}:${scope}:${scopeId}`

/**
 * The current user's "last seen" markers — the timestamp successor to the reads
 * collection (web has cut over; the reads TABLE stays for mobile). Shape scoped
 * `user_id = me` server-side (see routes/api/seen-state.ts) — no id set to pass,
 * so it needs no membership params and never rebuilds on scope change.
 *
 * Key is composite: one row per (user, scope, scope_id). NEVER_GC because the
 * always-mounted inbox / my-tasks badges subscribe to it, so it never idles.
 */
function _makeSeenStateCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
) {
  return defineCollection({
    id: `seen-state`,
    path: `/api/seen-state`,
    schema: seenStateRowSchema,
    getKey: (item: { user_id: string; scope: string; scope_id: string }) =>
      seenKey(item.user_id, item.scope, item.scope_id),
    gcTime: NEVER_GC,
    persistence,
    // No handlers — seen markers are written through @tanstack/offline-transactions
    // (see application/actions/seen.ts).
  })
}

// ---------------------------------------------------------------------------
// Badge slices — user-scoped subsets that exist so the ALWAYS-MOUNTED Sidebar
// inbox / my-tasks badges don't have to hold the full channel-scoped messages /
// tasks collections open for the whole session just to count the few rows that
// concern the current user. The server does the mention / assignee filter (see
// routes/api/inbox-mentions.ts and api/my-tasks.ts); the badge subscribes to
// these tiny shapes, and the full collections are freed to garbage-collect.
//
// gcTime: NEVER_GC — these ARE the always-mounted subscription, so they never
// idle; a finite gcTime would be moot. Persisted like the rest, so the badge count
// paints from OPFS on reload before Electric reconnects. Channel-scoped, so they
// rebuild with the other channel-scoped collections on a membership resync (see
// initializeCommunicationCollections callers). Read-only: no mutation handlers —
// messages/tasks are written via their full collections.
// ---------------------------------------------------------------------------

function _makeInboxMentionsCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
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
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
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
