import { createCollection } from "@tanstack/react-db"
import { electricCollectionOptions } from "@tanstack/electric-db-collection"
import { persistedCollectionOptions } from "@tanstack/browser-db-sqlite-persistence"
import { z } from "zod"
import {
  selectTaskSchema,
  selectMessageSchema,
  selectResourceSchema,
  selectPropertySchema,
  selectSeenStateSchema,
  PROPERTY_TYPES,
  ENTITY_TYPES,
  STATUS_VALUES,
  PRIORITY_VALUES,
  TASK_STATUS_VALUES,
  SEEN_SCOPES,
} from "%/infrastructure/database/schema/admin-schema"
import { getPersistence } from "../../infrastructure/persistence/browser-persistence"
import { retryOnError, coerceBool, origin, NEVER_GC, IDLE_GC_MS } from "./_shared"

// Electric SQL returns jsonb columns as JSON-encoded strings (e.g. '"critical"').
// z.preprocess unwraps them before Zod enum validation runs.
const unwrapJsonb = (v: unknown) =>
  typeof v === "string" && v.startsWith('"') ? JSON.parse(v) : v

const electricPropertySchema = selectPropertySchema.extend({
  type: z.preprocess(unwrapJsonb, z.enum(PROPERTY_TYPES)),
  entity: z.preprocess(unwrapJsonb, z.enum(ENTITY_TYPES)),
  status_value: z.preprocess(unwrapJsonb, z.enum(STATUS_VALUES).nullish()),
  priority_value: z.preprocess(unwrapJsonb, z.enum(PRIORITY_VALUES).nullish()),
  task_status_value: z.preprocess(unwrapJsonb, z.enum(TASK_STATUS_VALUES).nullish()),
})

const electricTaskSchema = selectTaskSchema.extend({
  completed: z.preprocess(coerceBool, z.boolean()),
})

const electricSeenStateSchema = selectSeenStateSchema.extend({
  scope: z.preprocess(unwrapJsonb, z.enum(SEEN_SCOPES)),
})

// ---------------------------------------------------------------------------
// Factory functions — collections are created AFTER memberships load so that
// membership-derived IDs can be baked into the shape URLs.
// ---------------------------------------------------------------------------

const TASKS_SCHEMA_VERSION = 3

function _makeTasksCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
  memberChannelIds: string[],
) {
  const url = new URL(`/api/tasks`, origin)
  if (memberChannelIds.length > 0) url.searchParams.set(`member_channel_ids`, memberChannelIds.join(`,`))
  return createCollection(
    persistedCollectionOptions({
      ...electricCollectionOptions({
        id: `tasks`,
        shapeOptions: {
          url: url.toString(),
          onError: retryOnError,
          parser: {
            timestamptz: (date: string) => {
              return new Date(date)
            },
          },
        },
        schema: electricTaskSchema,
        getKey: (item) => item.id,
        // Idle-GC: the always-mounted Sidebar "My Tasks" badge reads the
        // user-scoped myTasksCollection slice, and useSeen reads only seen_state
        // — so nothing always-mounted holds this full collection. Its only
        // subscribers are the channel/task views, so it idles (and closes its
        // shape stream) on the project list, Inbox and My-Tasks screens,
        // resurrecting + resuming from OPFS on the next visit.
        gcTime: IDLE_GC_MS,
        // Task writes go through @tanstack/offline-transactions — see
        // application/actions/tasks.ts. Direct collection.insert/update/delete
        // calls outside an offline transaction will fail with "no handler",
        // which is the intended loud failure mode.
      }),
      persistence,
      schemaVersion: TASKS_SCHEMA_VERSION,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
}

// Joins the persisted set at the SHARED schemaVersion 3 — NOT a new value.
// The documented adapter-collision failure is a version that DIFFERS from the
// others; matching it registers resources under the existing shared adapter in
// its own per-collection namespace, leaving every other collection's cached
// data untouched. Only the resource METADATA is persisted here; the heavy
// resources_raw table is server-only and never reaches the client.
const RESOURCES_SCHEMA_VERSION = 3

function _makeResourcesCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
  memberChannelIds: string[],
) {
  const url = new URL(`/api/resources`, origin)
  if (memberChannelIds.length > 0) url.searchParams.set(`member_channel_ids`, memberChannelIds.join(`,`))
  return createCollection(
    persistedCollectionOptions({
      ...electricCollectionOptions({
        id: `resources`,
        shapeOptions: {
          url: url.toString(),
          onError: retryOnError,
          parser: {
            timestamptz: (date: string) => {
              return new Date(date)
            },
            // int8 (file_size_bytes) arrives as a string, and Electric's DEFAULT parser
            // turns it into a BigInt. A BigInt cannot be JSON.stringify'd, and the
            // offline outbox persists each mutation's row as JSON — so deleting a file
            // died with "Do not know how to serialize a BigInt" before it reached the
            // server. A plain number is exact to 2^53, i.e. ~9 petabytes. This also
            // keeps the persisted OPFS rows JSON-serialisable.
            //
            // The zod preprocess below does NOT cover this — schema validation runs on
            // client mutations, not on rows arriving from sync.
            int8: (v: string) => Number(v),
          },
        },
        schema: selectResourceSchema.extend({
          file_size_bytes: z.preprocess(
            (v) => (typeof v === "string" || typeof v === "bigint" ? Number(v) : v),
            z.number()
          ),
        }),
        getKey: (item) => item.id,
        gcTime: NEVER_GC,
        // Resource deletes go through @tanstack/offline-transactions —
        // see application/actions/resources.ts.
      }),
      persistence,
      schemaVersion: RESOURCES_SCHEMA_VERSION,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
}

// MUST stay equal to every other collection's schema version. The persistence
// coordinator holds ONE adapter shared across all collections, and adapters are
// cached/keyed by schemaVersion — a different value here spawns a second adapter
// that overwrites the coordinator's, which then drives the other collections'
// offset/data through the wrong namespace and strands them on reload (Electric
// reports "up-to-date" but OPFS has no rows). The nullable channel_id addition
// is re-synced from Electric, so no cache-invalidation bump is needed.
//
// v2: task_status_value + percent_complete columns. Persisted rows predating them
// would validate against the new schema as undefined, and percent_complete rows
// cached before the backfill still carry their value in pending_task — so the
// local store must be discarded and re-synced rather than reused.
//
// THIS BUMP WENT IN ALONE AND BROKE THE INVARIANT ABOVE, which is exactly the
// failure the paragraph predicts: properties sat at 2 while all ten other
// collections stayed at 1, so two adapters existed, the second overwrote the
// coordinator's, and after login Electric reported up-to-date while nothing
// rendered. Every collection is now at 2. If you bump one, BUMP THEM ALL.
const PROPERTIES_SCHEMA_VERSION = 3

function _makePropertiesCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
  params: {
    memberProjectIds: string[]
    memberBuildunitIds: string[]
    memberChannelIds: string[]
  },
) {
  const url = new URL(`/api/properties`, origin)
  if (params.memberProjectIds.length > 0) url.searchParams.set(`member_project_ids`, params.memberProjectIds.join(`,`))
  if (params.memberBuildunitIds.length > 0) url.searchParams.set(`member_buildunit_ids`, params.memberBuildunitIds.join(`,`))
  if (params.memberChannelIds.length > 0) url.searchParams.set(`member_channel_ids`, params.memberChannelIds.join(`,`))
  return createCollection(
    persistedCollectionOptions({
      ...electricCollectionOptions({
        id: `properties`,
        shapeOptions: {
          url: url.toString(),
          onError: retryOnError,
          parser: {
            timestamptz: (date: string) => {
              return new Date(date)
            },
          },
        },
        schema: electricPropertySchema,
        getKey: (item) => item.id,
        // Idle-GC (not NEVER_GC): properties is subscribed ONLY by the channel /
        // build-unit / task routes — nothing always-mounted holds it (verified:
        // the Sidebar and unread badges never touch it). So it idles on the
        // project list, Inbox and My-Tasks screens, and GC closes its shape
        // stream there. Persisted, so the next channel/task visit resurrects it
        // and resumes from the OPFS offset rather than refetching. See IDLE_GC_MS.
        gcTime: IDLE_GC_MS,
        // Property writes go through @tanstack/offline-transactions —
        // see application/actions/properties.ts (create / update / delete).
      }),
      persistence,
      schemaVersion: PROPERTIES_SCHEMA_VERSION,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
}

// v2: the task_id column (status-change notes), and to hold the one-version-for-
// every-collection invariant documented above the properties version.
const MESSAGES_SCHEMA_VERSION = 3

function _makeMessagesCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
  memberChannelIds: string[],
) {
  const url = new URL(`/api/messages`, origin)
  if (memberChannelIds.length > 0) url.searchParams.set(`member_channel_ids`, memberChannelIds.join(`,`))
  return createCollection(
    persistedCollectionOptions({
      ...electricCollectionOptions({
        id: `messages`,
        shapeOptions: {
          url: url.toString(),
          onError: retryOnError,
          parser: {
            timestamptz: (date: string) => {
              return new Date(date)
            },
          },
        },
        schema: selectMessageSchema,
        getKey: (item) => item.id,
        // Idle-GC: with the Sidebar's per-channel unread pills removed, the
        // always-mounted inbox badge reading the inbox-mentions slice, and
        // useSeen reading only seen_state, nothing always-mounted holds this full
        // collection. It idles (and closes its shape stream) on the project list
        // / My-Tasks / Inbox screens, and resurrects + resumes from OPFS when a
        // channel or the Inbox view opens.
        gcTime: IDLE_GC_MS,
        // Message writes go through @tanstack/offline-transactions —
        // see application/actions/messages.ts. Delete is not currently
        // used by UI; add a mutationFn + action when needed.
      }),
      persistence,
      schemaVersion: MESSAGES_SCHEMA_VERSION,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
}

const SEEN_STATE_SCHEMA_VERSION = 3

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
  const url = new URL(`/api/seen-state`, origin)
  return createCollection(
    persistedCollectionOptions({
      ...electricCollectionOptions({
        id: `seen-state`,
        shapeOptions: {
          url: url.toString(),
          onError: retryOnError,
          parser: {
            timestamptz: (date: string) => {
              return new Date(date)
            },
          },
        },
        schema: electricSeenStateSchema,
        getKey: (item) => seenKey(item.user_id, item.scope, item.scope_id),
        gcTime: NEVER_GC,
        // Seen markers are written through @tanstack/offline-transactions —
        // see application/actions/seen.ts.
      }),
      persistence,
      schemaVersion: SEEN_STATE_SCHEMA_VERSION,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
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
// idle; a finite gcTime would be moot. Persisted at the shared v3 like the rest,
// so the badge count paints from OPFS on reload before Electric reconnects.
// Channel-scoped, so they rebuild with the other channel-scoped collections on a
// membership resync (see initializeCommunicationCollections callers).
// ---------------------------------------------------------------------------

const INBOX_MENTIONS_SCHEMA_VERSION = 3

function _makeInboxMentionsCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
  memberChannelIds: string[],
) {
  const url = new URL(`/api/inbox-mentions`, origin)
  if (memberChannelIds.length > 0) url.searchParams.set(`member_channel_ids`, memberChannelIds.join(`,`))
  return createCollection(
    persistedCollectionOptions({
      ...electricCollectionOptions({
        id: `inbox-mentions`,
        shapeOptions: {
          url: url.toString(),
          onError: retryOnError,
          parser: {
            timestamptz: (date: string) => {
              return new Date(date)
            },
          },
        },
        schema: selectMessageSchema,
        getKey: (item) => item.id,
        gcTime: NEVER_GC,
        // Read-only: no mutation handlers. Messages are written via the full
        // messagesCollection / offline-transactions path; this slice only reads.
      }),
      persistence,
      schemaVersion: INBOX_MENTIONS_SCHEMA_VERSION,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
}

const MY_TASKS_SCHEMA_VERSION = 3

function _makeMyTasksCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
  memberChannelIds: string[],
) {
  const url = new URL(`/api/my-tasks`, origin)
  if (memberChannelIds.length > 0) url.searchParams.set(`member_channel_ids`, memberChannelIds.join(`,`))
  return createCollection(
    persistedCollectionOptions({
      ...electricCollectionOptions({
        id: `my-tasks`,
        shapeOptions: {
          url: url.toString(),
          onError: retryOnError,
          parser: {
            timestamptz: (date: string) => {
              return new Date(date)
            },
          },
        },
        schema: electricTaskSchema,
        getKey: (item) => item.id,
        gcTime: NEVER_GC,
        // Read-only: no mutation handlers. Task writes go through the full
        // tasksCollection / offline-transactions path; this slice only reads.
      }),
      persistence,
      schemaVersion: MY_TASKS_SCHEMA_VERSION,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
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
