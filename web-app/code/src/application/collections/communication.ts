import { createCollection } from "@tanstack/react-db"
import { electricCollectionOptions } from "@tanstack/electric-db-collection"
import { persistedCollectionOptions } from "@tanstack/browser-db-sqlite-persistence"
import { z } from "zod"
import {
  selectTaskSchema,
  selectMessageSchema,
  selectResourceSchema,
  selectPropertySchema,
  PROPERTY_TYPES,
  ENTITY_TYPES,
  STATUS_VALUES,
  PRIORITY_VALUES,
} from "%/infrastructure/database/schema/admin-schema"
import { getPersistence } from "../../infrastructure/persistence/browser-persistence"
import { retryOnError, coerceBool, origin } from "./_shared"

// Electric SQL returns jsonb columns as JSON-encoded strings (e.g. '"critical"').
// z.preprocess unwraps them before Zod enum validation runs.
const unwrapJsonb = (v: unknown) =>
  typeof v === "string" && v.startsWith('"') ? JSON.parse(v) : v

const electricPropertySchema = selectPropertySchema.extend({
  type: z.preprocess(unwrapJsonb, z.enum(PROPERTY_TYPES)),
  entity: z.preprocess(unwrapJsonb, z.enum(ENTITY_TYPES)),
  status_value: z.preprocess(unwrapJsonb, z.enum(STATUS_VALUES).nullish()),
  priority_value: z.preprocess(unwrapJsonb, z.enum(PRIORITY_VALUES).nullish()),
})

const electricTaskSchema = selectTaskSchema.extend({
  completed: z.preprocess(coerceBool, z.boolean()),
})

// ---------------------------------------------------------------------------
// Factory functions — collections are created AFTER memberships load so that
// membership-derived IDs can be baked into the shape URLs.
// ---------------------------------------------------------------------------

const TASKS_SCHEMA_VERSION = 1

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
        },
      },
      schema: selectResourceSchema.extend({
        file_size_bytes: z.preprocess(
          (v) => (typeof v === "string" || typeof v === "bigint" ? Number(v) : v),
          z.number()
        ),
      }),
      getKey: (item) => item.id,
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
const PROPERTIES_SCHEMA_VERSION = 1

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
        // Property writes go through @tanstack/offline-transactions —
        // see application/actions/properties.ts. Update is not currently
        // used by UI; add a mutationFn + action when needed.
      }),
      persistence,
      schemaVersion: PROPERTIES_SCHEMA_VERSION,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
}

const MESSAGES_SCHEMA_VERSION = 1

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

// ---------------------------------------------------------------------------
// Deferred exports — initialized by initializeCommunicationCollections()
// called from the _authenticated loader after memberships preload.
// ---------------------------------------------------------------------------
export let tasksCollection: ReturnType<typeof _makeTasksCollection> = null!
export let resourcesCollection: ReturnType<typeof _makeResourcesCollection> = null!
export let propertiesCollection: ReturnType<typeof _makePropertiesCollection> = null!
export let messagesCollection: ReturnType<typeof _makeMessagesCollection> = null!

export async function initializeCommunicationCollections(params: {
  memberChannelIds: string[]
}) {
  if (import.meta.env.DEV) console.log(`[OPFS:comm] Initializing persisted collections…`)
  const t0 = performance.now()
  const { persistence } = await getPersistence()
  tasksCollection = _makeTasksCollection(persistence, params.memberChannelIds)
  messagesCollection = _makeMessagesCollection(persistence, params.memberChannelIds)
  resourcesCollection = _makeResourcesCollection(params.memberChannelIds)
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
