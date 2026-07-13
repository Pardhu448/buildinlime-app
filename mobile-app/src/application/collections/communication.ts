import { createCollection } from "@tanstack/react-db"
import { electricCollectionOptions } from "@tanstack/electric-db-collection"
import { persistedCollectionOptions } from "@tanstack/expo-db-sqlite-persistence"
import { z } from "zod"
import {
  PROPERTY_TYPES,
  TASK_STATUS_VALUES,
  ENTITY_TYPES,
  STATUS_VALUES,
  PRIORITY_VALUES,
} from "@buildinlime/domain-types"
import { trpc } from "../../infrastructure/trpc/client"
import { getPersistence } from "../../infrastructure/persistence/expo-persistence"
import { apiUrl, cookieFetch, retryOnError, coerceBool, unwrapJsonb, parser, NEVER_GC, safeCleanup } from "./_shared"

// --- Schemas ---

const selectTaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  completed: z.preprocess(coerceBool, z.boolean()),
  opened_at: z.union([z.string(), z.date()]).optional(),
  closed_at: z.union([z.string(), z.date()]).optional(),
  channel_id: z.string(),
  buildunit_id: z.string(),
  createdby_id: z.string(),
  assignee_id: z.string().nullable().optional(),
})

const selectMessageSchema = z.object({
  id: z.string(),
  text: z.string(),
  channel_id: z.string(),
  buildunit_id: z.string(),
  project_id: z.string(),
  createdby_id: z.string(),
  mention_ids: z.array(z.string()).nullable().optional(),
  resource_ids: z.array(z.string()).nullable().optional(),
  parent_id: z.string().nullable().optional(),
  created_at: z.union([z.string(), z.date()]).optional(),
})

const selectResourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  file_location: z.string(),
  mime_type: z.string(),
  file_size_bytes: z.preprocess(
    (v) => (typeof v === "string" || typeof v === "bigint" ? Number(v) : v),
    z.number()
  ),
  uploaded_at: z.union([z.string(), z.date()]).optional(),
  channel_id: z.string(),
  buildunit_id: z.string(),
  project_id: z.string(),
  message_id: z.string().nullable().optional(),
  task_id: z.string().nullable().optional(),
  createdby_id: z.string(),
})

// Zod strips unknown keys, so a column missing from this object is DROPPED from
// the synced row — it does not merely go untyped. percent_complete and
// task_status_value must be listed here or the pills read undefined.
const selectPropertySchema = z.object({
  id: z.string(),
  type: z.preprocess(unwrapJsonb, z.enum(PROPERTY_TYPES)),
  entity: z.preprocess(unwrapJsonb, z.enum(ENTITY_TYPES)),
  entity_id: z.string(),
  status_value: z.preprocess(unwrapJsonb, z.enum(STATUS_VALUES).nullish()),
  priority_value: z.preprocess(unwrapJsonb, z.enum(PRIORITY_VALUES).nullish()),
  task_status_value: z.preprocess(unwrapJsonb, z.enum(TASK_STATUS_VALUES).nullish()),
  target_date: z.union([z.string(), z.date()]).nullable().optional(),
  start_date: z.union([z.string(), z.date()]).nullable().optional(),
  pending_task: z.string().nullable().optional(),
  // Own column as of migration 0003; it used to share `pending_task`.
  percent_complete: z.string().nullable().optional(),
  label_value: z.string().nullable().optional(),
  created_at: z.union([z.string(), z.date()]).optional(),
})

// ---------------------------------------------------------------------------
// Factory functions — collections are created AFTER memberships load so that
// membership-derived IDs can be baked into the shape URLs.
// ---------------------------------------------------------------------------

const TASKS_SCHEMA_VERSION = 1

function _makeTasksCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
  memberChannelIds: string[],
) {
  const url = new URL(`/api/tasks`, apiUrl)
  if (memberChannelIds.length > 0) {
    url.searchParams.set(`member_channel_ids`, memberChannelIds.join(`,`))
  }
  return createCollection(
    persistedCollectionOptions({
      ...electricCollectionOptions({
        id: `tasks`,
        shapeOptions: {
          url: url.toString(),
          fetchClient: cookieFetch,
          onError: retryOnError,
          parser,
        },
        schema: selectTaskSchema,
        getKey: (item) => item.id,
        gcTime: NEVER_GC,
        // onInsert/onUpdate/onDelete removed — routed through
        // @tanstack/offline-transactions (see application/actions/tasks.ts).
      }),
      persistence,
      schemaVersion: TASKS_SCHEMA_VERSION,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
}

const MESSAGES_SCHEMA_VERSION = 1

function _makeMessagesCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
  memberChannelIds: string[],
) {
  const url = new URL(`/api/messages`, apiUrl)
  if (memberChannelIds.length > 0) {
    url.searchParams.set(`member_channel_ids`, memberChannelIds.join(`,`))
  }
  return createCollection(
    persistedCollectionOptions({
      ...electricCollectionOptions({
        id: `messages`,
        shapeOptions: {
          url: url.toString(),
          fetchClient: cookieFetch,
          onError: retryOnError,
          parser,
        },
        schema: selectMessageSchema,
        getKey: (item) => item.id,
        gcTime: NEVER_GC,
        // onInsert removed — routed through @tanstack/offline-transactions
        // (see application/actions/messages.ts → createMessageAction).
        onDelete: async ({ transaction }) => {
          const { original: m } = transaction.mutations[0]
          const result = await trpc.messages.delete.mutate({ id: m.id })
          return { txid: result.txid }
        },
      }),
      persistence,
      schemaVersion: MESSAGES_SCHEMA_VERSION,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
}

function _makeResourcesCollection(memberChannelIds: string[]) {
  const url = new URL(`/api/resources`, apiUrl)
  if (memberChannelIds.length > 0) {
    url.searchParams.set(`member_channel_ids`, memberChannelIds.join(`,`))
  }
  return createCollection(
    electricCollectionOptions({
      id: `resources`,
      shapeOptions: {
        url: url.toString(),
        fetchClient: cookieFetch,
        onError: retryOnError,
        parser,
      },
      schema: selectResourceSchema,
      getKey: (item) => item.id,
      gcTime: NEVER_GC,
      // onDelete removed — routed through @tanstack/offline-transactions
      // (see application/actions/resources.ts → deleteResourceAction).
    })
  )
}

// v2: task_status_value + percent_complete columns. Rows cached before migration
// 0003 still carry the percent value in pending_task, so the local store has to be
// discarded and re-synced rather than reused — otherwise the percent pill reads a
// column the backfill has already emptied.
const PROPERTIES_SCHEMA_VERSION = 2

function _makePropertiesCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
  params: {
    memberProjectIds: string[]
    memberBuildunitIds: string[]
    memberChannelIds: string[]
  },
) {
  // The /api/properties shape OR's two scopes: project/build-unit properties by
  // entity_id (member_project_ids ∪ member_buildunit_ids), and channel + TASK
  // properties by the denormalized channel_id (member_channel_ids). Task
  // properties therefore ride the same channel scope as tasks/messages — a new
  // task's properties in a visible channel sync with no rebuild, so no
  // member_task_ids snapshot is needed (server ignores it).
  const url = new URL(`/api/properties`, apiUrl)
  if (params.memberProjectIds.length > 0)
    url.searchParams.set(`member_project_ids`, params.memberProjectIds.join(`,`))
  if (params.memberBuildunitIds.length > 0)
    url.searchParams.set(`member_buildunit_ids`, params.memberBuildunitIds.join(`,`))
  if (params.memberChannelIds.length > 0)
    url.searchParams.set(`member_channel_ids`, params.memberChannelIds.join(`,`))
  return createCollection(
    persistedCollectionOptions({
      ...electricCollectionOptions({
        id: `properties`,
        shapeOptions: {
          url: url.toString(),
          fetchClient: cookieFetch,
          onError: retryOnError,
          parser,
        },
        schema: selectPropertySchema,
        getKey: (item) => item.id,
        gcTime: NEVER_GC,
        // onInsert removed — routed through @tanstack/offline-transactions
        // (see application/actions/properties.ts → createPropertyAction).
        onUpdate: async ({ transaction }) => {
          const { modified: p } = transaction.mutations[0]
          const result = await trpc.properties.update.mutate({
            id: p.id,
            data: {
              status_value: p.status_value,
              priority_value: p.priority_value,
              target_date: p.target_date,
              start_date: p.start_date,
              pending_task: p.pending_task,
            },
          })
          return { txid: result.txid }
        },
        // onDelete removed — routed through @tanstack/offline-transactions
        // (see application/actions/properties.ts → deletePropertyAction).
      }),
      persistence,
      schemaVersion: PROPERTIES_SCHEMA_VERSION,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
}

// ---------------------------------------------------------------------------
// Deferred exports — initialized by initializeCommunicationCollections()
// and initializePropertiesCollection() after memberships and tasks preload.
// ---------------------------------------------------------------------------
export let tasksCollection: ReturnType<typeof _makeTasksCollection> = null!
export let messagesCollection: ReturnType<typeof _makeMessagesCollection> = null!
export let resourcesCollection: ReturnType<typeof _makeResourcesCollection> = null!
export let propertiesCollection: ReturnType<typeof _makePropertiesCollection> = null!

export function initializeCommunicationCollections(params: {
  memberChannelIds: string[]
}) {
  const { persistence } = getPersistence()
  // On a project switch / channel-set resync these hold the previous instances;
  // stop their sync before replacing (GC is disabled, so nothing else will).
  safeCleanup(tasksCollection)
  safeCleanup(messagesCollection)
  safeCleanup(resourcesCollection)
  tasksCollection = _makeTasksCollection(persistence, params.memberChannelIds)
  messagesCollection = _makeMessagesCollection(persistence, params.memberChannelIds)
  resourcesCollection = _makeResourcesCollection(params.memberChannelIds)
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
  safeCleanup(tasksCollection)
  safeCleanup(messagesCollection)
  safeCleanup(resourcesCollection)
  safeCleanup(propertiesCollection)
  tasksCollection = null!
  messagesCollection = null!
  resourcesCollection = null!
  propertiesCollection = null!
}
