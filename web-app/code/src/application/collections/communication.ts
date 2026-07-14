import { createCollection } from "@tanstack/react-db"
import { electricCollectionOptions } from "@tanstack/electric-db-collection"
import { persistedCollectionOptions } from "@tanstack/browser-db-sqlite-persistence"
import { z } from "zod"
import {
  selectTaskSchema,
  selectMessageSchema,
  selectResourceSchema,
  selectPropertySchema,
  selectReadSchema,
  PROPERTY_TYPES,
  ENTITY_TYPES,
  STATUS_VALUES,
  PRIORITY_VALUES,
  TASK_STATUS_VALUES,
  READ_ITEM_TYPES,
} from "%/infrastructure/database/schema/admin-schema"
import { getPersistence } from "../../infrastructure/persistence/browser-persistence"
import { retryOnError, coerceBool, origin, NEVER_GC } from "./_shared"

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

const electricReadSchema = selectReadSchema.extend({
  item_type: z.preprocess(unwrapJsonb, z.enum(READ_ITEM_TYPES)),
})

// ---------------------------------------------------------------------------
// Factory functions — collections are created AFTER memberships load so that
// membership-derived IDs can be baked into the shape URLs.
// ---------------------------------------------------------------------------

const TASKS_SCHEMA_VERSION = 2

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
        gcTime: NEVER_GC,
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

function _makeResourcesCollection(memberChannelIds: string[]) {
  const url = new URL(`/api/resources`, origin)
  if (memberChannelIds.length > 0) url.searchParams.set(`member_channel_ids`, memberChannelIds.join(`,`))
  return createCollection(
    electricCollectionOptions({
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
          // server. A plain number is exact to 2^53, i.e. ~9 petabytes.
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
    })
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
const PROPERTIES_SCHEMA_VERSION = 2

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
        gcTime: NEVER_GC,
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
const MESSAGES_SCHEMA_VERSION = 2

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
        gcTime: NEVER_GC,
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

const READS_SCHEMA_VERSION = 2

/**
 * The reads collection's key. Exported because the optimistic write in
 * actions/reads.ts must check for an existing row before inserting, and a key
 * built differently there would silently miss and throw "already exists".
 */
export const readKey = (userId: string, itemType: string, itemId: string) =>
  `${userId}:${itemType}:${itemId}`

/**
 * The current user's read state. The shape is scoped `user_id = me` server-side
 * (see routes/api/reads.ts) — there is no id set to pass, so unlike the other
 * collections this needs no membership params and never rebuilds on scope change.
 *
 * The key is composite: one row per (user, item_type, item_id).
 */
function _makeReadsCollection(
  persistence: Awaited<ReturnType<typeof getPersistence>>["persistence"],
) {
  const url = new URL(`/api/reads`, origin)
  return createCollection(
    persistedCollectionOptions({
      ...electricCollectionOptions({
        id: `reads`,
        shapeOptions: {
          url: url.toString(),
          onError: retryOnError,
          parser: {
            timestamptz: (date: string) => {
              return new Date(date)
            },
          },
        },
        schema: electricReadSchema,
        getKey: (item) => readKey(item.user_id, item.item_type, item.item_id),
        gcTime: NEVER_GC,
        // Reads are written through @tanstack/offline-transactions —
        // see application/actions/reads.ts.
      }),
      persistence,
      schemaVersion: READS_SCHEMA_VERSION,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
}

// ---------------------------------------------------------------------------
// Deferred exports — initialized by initializeCommunicationCollections()
// called from the _authenticated loader after memberships preload.
// ---------------------------------------------------------------------------
export let tasksCollection: ReturnType<typeof _makeTasksCollection> = null!
export let resourcesCollection: ReturnType<typeof _makeResourcesCollection> = null!
export let propertiesCollection: ReturnType<typeof _makePropertiesCollection> = null!
export let messagesCollection: ReturnType<typeof _makeMessagesCollection> = null!
export let readsCollection: ReturnType<typeof _makeReadsCollection> = null!

export async function initializeCommunicationCollections(params: {
  memberChannelIds: string[]
}) {
  if (import.meta.env.DEV) console.log(`[OPFS:comm] Initializing persisted collections…`)
  const t0 = performance.now()
  const { persistence } = await getPersistence()
  tasksCollection = _makeTasksCollection(persistence, params.memberChannelIds)
  messagesCollection = _makeMessagesCollection(persistence, params.memberChannelIds)
  resourcesCollection = _makeResourcesCollection(params.memberChannelIds)
  // Reads are scoped `user_id = me` server-side, not by membership, so this is
  // built once and deliberately NOT rebuilt on a membership resync (which
  // re-enters this function) — rebuilding would orphan the live instance for no
  // gain.
  if (!readsCollection) readsCollection = _makeReadsCollection(persistence)
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
