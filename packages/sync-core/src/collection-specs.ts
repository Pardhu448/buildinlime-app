// The per-table collection DESCRIPTORS — one copy, shared by both apps.
//
// sync-core already owned the machinery that turns a spec into collection
// options (makeCollectionOptionsBuilder in ./collections). What it did not own
// was the specs themselves, so every table's id, route, shape parameters, row
// schema, key function and GC tier existed twice — once per app — with nothing
// keeping the two copies equal. They had already started to drift in their
// comments.
//
// What stays at the CALL SITE, deliberately:
//
//   persistence  different engines (OPFS/wa-sqlite on web, expo-sqlite on
//                mobile), and web resolves it asynchronously where mobile is
//                synchronous.
//   handlers     only one app writes through most of these. Web wires onInsert
//                on projects/build-units/channels; mobile wires onUpdate on
//                properties. Everything else takes no handler on purpose — a
//                missing handler makes a stray collection.insert() fail loudly,
//                which is the intended design (writes go through
//                @tanstack/offline-transactions).
//   onError      memberships overrides it with the app's own retry singleton.
//
// `teams` is not here: it exists on web only, so a shared descriptor would be a
// second home for a single call site.

import {
  userRowSchema,
  membershipRowSchema,
  projectRowSchema,
  buildUnitRowSchema,
  channelRowSchema,
  taskRowSchema,
  messageRowSchema,
  resourceRowSchema,
  propertyRowSchema,
  seenStateRowSchema,
} from "@buildinlime/contracts"
import { NEVER_GC, IDLE_GC_MS } from "./collections"
import type { CollectionSpec } from "./collections"

/** A descriptor minus the parts each app supplies for itself. */
export type SharedCollectionSpec = Omit<CollectionSpec, "persistence" | "handlers">

const byId = (item: { id: string }) => item.id

// ---------------------------------------------------------------------------
// Always-mounted spine (NEVER_GC)
//
// These are held for the whole session by an always-mounted subscriber — web's
// Sidebar, mobile's DrawerContent — so GC would never fire for them anyway. A
// non-finite gcTime makes startGCTimer() skip scheduling entirely.
// ---------------------------------------------------------------------------

export const usersSpec = (): SharedCollectionSpec => ({
  id: `users`,
  path: `/api/users`,
  schema: userRowSchema,
  getKey: byId,
  gcTime: NEVER_GC,
})

/**
 * The current user's SELF membership stream — scoped `user_id = me` server-side,
 * so it takes no id parameters and never rebuilds on a scope change.
 *
 * Every other scoped shape derives its id sets from this one, which is why it
 * loads first and why the call site passes an `onError` that RECORDS the failure
 * before retrying: Electric marks a collection ready from its error path as well
 * as on up-to-date, so "ready with zero rows" has to be distinguishable from a
 * shape that failed. See makeShapeRetry.
 */
export const membershipsSpec = (): SharedCollectionSpec => ({
  id: `memberships`,
  path: `/api/memberships`,
  schema: membershipRowSchema,
  getKey: byId,
  gcTime: NEVER_GC,
})

/**
 * The channel ROSTER — who belongs to a channel, for assignee pickers.
 *
 * Note the parameter name: this route takes `channel_ids`, not the `member_ids`
 * the other organization routes take. It is also NOT membershipsSpec: that one is
 * scoped `user_id = me`, so filtering it by channel yields exactly one row (you).
 */
export const channelMembersSpec = (channelIds: string[]): SharedCollectionSpec => ({
  id: `channel-members`,
  path: `/api/channel-members`,
  params: { channel_ids: channelIds },
  schema: membershipRowSchema,
  getKey: byId,
  gcTime: NEVER_GC,
})

export const projectsSpec = (memberProjectIds: string[]): SharedCollectionSpec => ({
  id: `projects`,
  path: `/api/projects`,
  params: { member_ids: memberProjectIds },
  schema: projectRowSchema,
  getKey: byId,
  gcTime: NEVER_GC,
})

export const buildUnitsSpec = (memberBuildunitIds: string[]): SharedCollectionSpec => ({
  id: `build-units`,
  path: `/api/buildunits`,
  params: { member_ids: memberBuildunitIds },
  schema: buildUnitRowSchema,
  getKey: byId,
  gcTime: NEVER_GC,
})

export const channelsSpec = (memberChannelIds: string[]): SharedCollectionSpec => ({
  id: `channels`,
  path: `/api/channels`,
  params: { member_ids: memberChannelIds },
  schema: channelRowSchema,
  getKey: byId,
  gcTime: NEVER_GC,
})

/** One row per (user, scope, scope_id) — the composite key for seen state. */
export const seenKey = (userId: string, scope: string, scopeId: string) =>
  `${userId}:${scope}:${scopeId}`

/**
 * The current user's "last seen" markers — the timestamp successor to the reads
 * collection. Scoped `user_id = me` server-side with no parameter able to widen
 * it, so it takes no membership ids and never rebuilds on a scope change.
 *
 * NEVER_GC because the always-mounted unread badges subscribe to it.
 */
export const seenStateSpec = (): SharedCollectionSpec => ({
  id: `seen-state`,
  path: `/api/seen-state`,
  schema: seenStateRowSchema,
  getKey: (item: { user_id: string; scope: string; scope_id: string }) =>
    seenKey(item.user_id, item.scope, item.scope_id),
  gcTime: NEVER_GC,
})

/**
 * Narrow badge slices. NEVER_GC for the same reason as the spine: the unread
 * pills that read them are always mounted. They exist precisely SO the heavy
 * messages/tasks collections below can idle — the badges read these instead.
 */
export const inboxMentionsSpec = (memberChannelIds: string[]): SharedCollectionSpec => ({
  id: `inbox-mentions`,
  path: `/api/inbox-mentions`,
  params: { member_channel_ids: memberChannelIds },
  schema: messageRowSchema,
  getKey: byId,
  gcTime: NEVER_GC,
})

export const myTasksSpec = (memberChannelIds: string[]): SharedCollectionSpec => ({
  id: `my-tasks`,
  path: `/api/my-tasks`,
  params: { member_channel_ids: memberChannelIds },
  schema: taskRowSchema,
  getKey: byId,
  gcTime: NEVER_GC,
})

// ---------------------------------------------------------------------------
// Heavy, screen-scoped collections (IDLE_GC_MS)
//
// Nothing always-mounted holds these: the badges read the narrow slices above
// and the unread logic reads seen_state, so their only subscribers are the
// channel/task screens. They genuinely go idle on the project list, Inbox and
// My-Tasks screens, and GC closing their long-poll is the point. Persisted, so
// the next visit resurrects and RESUMES from the stored offset rather than
// refetching — resurrection is driven by addSubscriber, so it needs a live
// query (a bare .get() will not revive one). See the GC tier note in
// ./collections.
// ---------------------------------------------------------------------------

export const tasksSpec = (memberChannelIds: string[]): SharedCollectionSpec => ({
  id: `tasks`,
  path: `/api/tasks`,
  params: { member_channel_ids: memberChannelIds },
  schema: taskRowSchema,
  getKey: byId,
  gcTime: IDLE_GC_MS,
})

export const messagesSpec = (memberChannelIds: string[]): SharedCollectionSpec => ({
  id: `messages`,
  path: `/api/messages`,
  params: { member_channel_ids: memberChannelIds },
  schema: messageRowSchema,
  getKey: byId,
  gcTime: IDLE_GC_MS,
})

/**
 * Metadata only — file bytes and thumbnails load from the separate
 * /api/resources/:id/file route, so GC'ing this never affects a rendered
 * thumbnail.
 */
export const resourcesSpec = (memberChannelIds: string[]): SharedCollectionSpec => ({
  id: `resources`,
  path: `/api/resources`,
  params: { member_channel_ids: memberChannelIds },
  schema: resourceRowSchema,
  getKey: byId,
  gcTime: IDLE_GC_MS,
})

/**
 * Scoped by entity_id (project/build-unit) AND by the denormalized channel_id
 * (channel/task properties) — no task-id dependency, so it can be built in
 * parallel with the other channel-scoped collections rather than waiting for
 * tasks to land.
 */
export const propertiesSpec = (params: {
  memberProjectIds: string[]
  memberBuildunitIds: string[]
  memberChannelIds: string[]
}): SharedCollectionSpec => ({
  id: `properties`,
  path: `/api/properties`,
  params: {
    member_project_ids: params.memberProjectIds,
    member_buildunit_ids: params.memberBuildunitIds,
    member_channel_ids: params.memberChannelIds,
  },
  schema: propertyRowSchema,
  getKey: byId,
  gcTime: IDLE_GC_MS,
})
