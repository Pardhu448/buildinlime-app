import { createCollection } from "@tanstack/react-db"
import { electricCollectionOptions } from "@tanstack/electric-db-collection"
import { persistedCollectionOptions } from "@tanstack/expo-db-sqlite-persistence"
import { z } from "zod"
import {
  PROPERTY_TYPES,
  ENTITY_TYPES,
  STATUS_VALUES,
  PRIORITY_VALUES,
} from "@buildinlime/domain-types"
import { trpc } from "../../infrastructure/trpc/client"
import { getPersistence } from "../../infrastructure/persistence/expo-persistence"
import { apiUrl, cookieFetch, retryOnError, coerceBool, unwrapJsonb, parser } from "./_shared"

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

const selectPropertySchema = z.object({
  id: z.string(),
  type: z.preprocess(unwrapJsonb, z.enum(PROPERTY_TYPES)),
  entity: z.preprocess(unwrapJsonb, z.enum(ENTITY_TYPES)),
  entity_id: z.string(),
  status_value: z.preprocess(unwrapJsonb, z.enum(STATUS_VALUES).nullish()),
  priority_value: z.preprocess(unwrapJsonb, z.enum(PRIORITY_VALUES).nullish()),
  target_date: z.union([z.string(), z.date()]).nullable().optional(),
  start_date: z.union([z.string(), z.date()]).nullable().optional(),
  pending_task: z.string().nullable().optional(),
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
        onInsert: async ({ transaction }) => {
          const { modified: t } = transaction.mutations[0]
          const result = await trpc.tasks.create.mutate({
            id: t.id,
            name: t.name,
            description: t.description,
            completed: t.completed,
            channel_id: t.channel_id,
            buildunit_id: t.buildunit_id,
            createdby_id: t.createdby_id,
            assignee_id: t.assignee_id ?? null,
          })
          return { txid: result.txid }
        },
        onUpdate: async ({ transaction }) => {
          const { modified: t } = transaction.mutations[0]
          const result = await trpc.tasks.update.mutate({
            id: t.id,
            data: {
              name: t.name,
              description: t.description,
              completed: coerceBool(t.completed),
              assignee_id: t.assignee_id,
            },
          })
          return { txid: result.txid }
        },
        onDelete: async ({ transaction }) => {
          const { original: t } = transaction.mutations[0]
          const result = await trpc.tasks.delete.mutate({ id: t.id })
          return { txid: result.txid }
        },
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
        onInsert: async ({ transaction }) => {
          const { modified: m } = transaction.mutations[0]
          const result = await trpc.messages.create.mutate({
            id: m.id,
            text: m.text,
            channel_id: m.channel_id,
            buildunit_id: m.buildunit_id,
            project_id: m.project_id,
            createdby_id: m.createdby_id,
            mention_ids: m.mention_ids,
            resource_ids: m.resource_ids,
            parent_id: m.parent_id ?? null,
          })
          return { txid: result.txid }
        },
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
      onDelete: async ({ transaction }) => {
        const { original: r } = transaction.mutations[0]
        const result = await trpc.resources.delete.mutate({ id: r.id })
        return { txid: result.txid }
      },
    })
  )
}

const PROPERTIES_SCHEMA_VERSION = 1

function _makePropertiesCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
  params: {
    memberProjectIds: string[]
    memberBuildunitIds: string[]
    memberChannelIds: string[]
    memberTaskIds: string[]
  },
) {
  const url = new URL(`/api/properties`, apiUrl)
  if (params.memberProjectIds.length > 0)
    url.searchParams.set(`member_project_ids`, params.memberProjectIds.join(`,`))
  if (params.memberBuildunitIds.length > 0)
    url.searchParams.set(`member_buildunit_ids`, params.memberBuildunitIds.join(`,`))
  if (params.memberChannelIds.length > 0)
    url.searchParams.set(`member_channel_ids`, params.memberChannelIds.join(`,`))
  if (params.memberTaskIds.length > 0)
    url.searchParams.set(`member_task_ids`, params.memberTaskIds.join(`,`))
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
        onInsert: async ({ transaction }) => {
          const { modified: p } = transaction.mutations[0]
          const result = await trpc.properties.create.mutate({
            id: p.id,
            type: p.type,
            entity: p.entity,
            entity_id: p.entity_id,
            status_value: p.status_value,
            priority_value: p.priority_value,
            target_date: p.target_date,
            start_date: p.start_date,
            pending_task: p.pending_task,
            label_value: p.label_value,
          })
          return { txid: result.txid }
        },
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
        onDelete: async ({ transaction }) => {
          const { original: p } = transaction.mutations[0]
          const result = await trpc.properties.delete.mutate({ id: p.id })
          return { txid: result.txid }
        },
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
  tasksCollection = _makeTasksCollection(persistence, params.memberChannelIds)
  messagesCollection = _makeMessagesCollection(persistence, params.memberChannelIds)
  resourcesCollection = _makeResourcesCollection(params.memberChannelIds)
}

// Must be called AFTER tasksCollection has preloaded so task IDs are known.
// Task IDs are a snapshot — tasks created after load won't have their
// properties stream until the app is reloaded.
export function initializePropertiesCollection(params: {
  memberProjectIds: string[]
  memberBuildunitIds: string[]
  memberChannelIds: string[]
  memberTaskIds: string[]
}) {
  const { persistence } = getPersistence()
  propertiesCollection = _makePropertiesCollection(persistence, params)
}

export function resetCommunicationCollections() {
  tasksCollection = null!
  messagesCollection = null!
  resourcesCollection = null!
  propertiesCollection = null!
}
