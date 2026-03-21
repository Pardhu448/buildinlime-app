import { createCollection } from "@tanstack/react-db"
import { electricCollectionOptions } from "@tanstack/electric-db-collection"
import { z } from "zod"
import {
  CHANNEL_NAMES,
  PROPERTY_TYPES,
  ENTITY_TYPES,
  STATUS_VALUES,
  PRIORITY_VALUES,
} from "@buildinlime/domain-types"
import { createCookieFetch } from "../../infrastructure/auth/cookie-fetch"
import { trpc } from "../../infrastructure/trpc/client"

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000"

const retryOnError = async (error: Error) => {
  const delay = error.message.includes("401") ? 2000 : 5000
  await new Promise((resolve) => setTimeout(resolve, delay))
}

const coerceBool = (v: unknown) => v === "true" || v === true
const unwrapJsonb = (v: unknown) =>
  typeof v === "string" && v.startsWith('"') ? JSON.parse(v) : v

// Schemas
const buildUnitSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  project_id: z.string(),
  owner_id: z.string(),
  health: z.preprocess(unwrapJsonb, z.enum(["On track", "At risk", "Off track"]).nullish()),
  priority: z.preprocess(unwrapJsonb, z.enum(["High", "Mid", "Low"]).nullish()),
  task_name: z.string().nullable().optional(),
  task_assignee: z.string().nullable().optional(),
  task_since: z.string().nullable().optional(),
  target_date: z.string().nullable().optional(),
  status_percent: z.string().nullable().optional(),
  created_at: z.union([z.string(), z.date()]).optional(),
})

const channelSchema = z.object({
  id: z.string(),
  name: z.preprocess(unwrapJsonb, z.enum(CHANNEL_NAMES)),
  description: z.string().nullable().optional(),
  buildunit_id: z.string(),
  owner_id: z.string(),
  created_at: z.union([z.string(), z.date()]).optional(),
})

const taskSchema = z.object({
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

const messageSchema = z.object({
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

const resourceSchema = z.object({
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

const propertySchema = z.object({
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

export interface ScopedCollections {
  buildUnitsCollection: ReturnType<typeof createCollection>
  channelsCollection: ReturnType<typeof createCollection>
  tasksCollection: ReturnType<typeof createCollection>
  messagesCollection: ReturnType<typeof createCollection>
  resourcesCollection: ReturnType<typeof createCollection>
  propertiesCollection: ReturnType<typeof createCollection>
}

// Cache collections per projectId to avoid recreating on re-renders
const cache = new Map<string, ScopedCollections>()

/**
 * Creates (or returns cached) Electric collections scoped to a single project.
 * All shape URLs include ?project_id=... so the backend proxy only streams
 * data belonging to that project.
 */
export function createScopedCollections(projectId: string): ScopedCollections {
  if (cache.has(projectId)) return cache.get(projectId)!

  const cookieFetch = createCookieFetch()
  const url = (path: string) => `${apiUrl}${path}?project_id=${projectId}`
  const parser = { timestamptz: (d: string) => new Date(d) }

  const collections: ScopedCollections = {
    buildUnitsCollection: createCollection(
      electricCollectionOptions({
        id: `build-units-${projectId}`,
        shapeOptions: { url: url(`/api/buildunits`), fetchClient: cookieFetch, onError: retryOnError, parser },
        schema: buildUnitSchema,
        getKey: (item) => item.id,
        onInsert: async ({ transaction }) => {
          const { modified: b } = transaction.mutations[0]
          const result = await trpc.buildUnits.create.mutate({
            id: b.id, name: b.name, description: b.description,
            project_id: b.project_id, owner_id: b.owner_id,
          })
          return { txid: result.txid }
        },
        onUpdate: async ({ transaction }) => {
          const { modified: b } = transaction.mutations[0]
          const result = await trpc.buildUnits.update.mutate({
            id: b.id, data: { name: b.name, description: b.description },
          })
          return { txid: result.txid }
        },
        onDelete: async ({ transaction }) => {
          const { original: b } = transaction.mutations[0]
          const result = await trpc.buildUnits.delete.mutate({ id: b.id })
          return { txid: result.txid }
        },
      })
    ),

    channelsCollection: createCollection(
      electricCollectionOptions({
        id: `channels-${projectId}`,
        shapeOptions: { url: url(`/api/channels`), fetchClient: cookieFetch, onError: retryOnError, parser },
        schema: channelSchema,
        getKey: (item) => item.id,
        onInsert: async ({ transaction }) => {
          const { modified: c } = transaction.mutations[0]
          const result = await trpc.channels.create.mutate({
            id: c.id, name: c.name, description: c.description,
            buildunit_id: c.buildunit_id, owner_id: c.owner_id,
          })
          return { txid: result.txid }
        },
        onUpdate: async ({ transaction }) => {
          const { modified: c } = transaction.mutations[0]
          const result = await trpc.channels.update.mutate({
            id: c.id, data: { name: c.name, description: c.description },
          })
          return { txid: result.txid }
        },
        onDelete: async ({ transaction }) => {
          const { original: c } = transaction.mutations[0]
          const result = await trpc.channels.delete.mutate({ id: c.id })
          return { txid: result.txid }
        },
      })
    ),

    tasksCollection: createCollection(
      electricCollectionOptions({
        id: `tasks-${projectId}`,
        shapeOptions: { url: url(`/api/tasks`), fetchClient: cookieFetch, onError: retryOnError, parser },
        schema: taskSchema,
        getKey: (item) => item.id,
        onInsert: async ({ transaction }) => {
          const { modified: t } = transaction.mutations[0]
          const result = await trpc.tasks.create.mutate({
            id: t.id, name: t.name, description: t.description,
            completed: t.completed, channel_id: t.channel_id,
            buildunit_id: t.buildunit_id, createdby_id: t.createdby_id,
            assignee_id: t.assignee_id ?? null,
          })
          return { txid: result.txid }
        },
        onUpdate: async ({ transaction }) => {
          const { modified: t } = transaction.mutations[0]
          const result = await trpc.tasks.update.mutate({
            id: t.id,
            data: {
              name: t.name, description: t.description,
              completed: coerceBool(t.completed), assignee_id: t.assignee_id,
            },
          })
          return { txid: result.txid }
        },
        onDelete: async ({ transaction }) => {
          const { original: t } = transaction.mutations[0]
          const result = await trpc.tasks.delete.mutate({ id: t.id })
          return { txid: result.txid }
        },
      })
    ),

    messagesCollection: createCollection(
      electricCollectionOptions({
        id: `messages-${projectId}`,
        shapeOptions: { url: url(`/api/messages`), fetchClient: cookieFetch, onError: retryOnError, parser },
        schema: messageSchema,
        getKey: (item) => item.id,
        onInsert: async ({ transaction }) => {
          const { modified: m } = transaction.mutations[0]
          const result = await trpc.messages.create.mutate({
            id: m.id, text: m.text, channel_id: m.channel_id,
            buildunit_id: m.buildunit_id, project_id: m.project_id,
            createdby_id: m.createdby_id, mention_ids: m.mention_ids,
            resource_ids: m.resource_ids, parent_id: m.parent_id ?? null,
          })
          return { txid: result.txid }
        },
        onDelete: async ({ transaction }) => {
          const { original: m } = transaction.mutations[0]
          const result = await trpc.messages.delete.mutate({ id: m.id })
          return { txid: result.txid }
        },
      })
    ),

    resourcesCollection: createCollection(
      electricCollectionOptions({
        id: `resources-${projectId}`,
        shapeOptions: { url: url(`/api/resources`), fetchClient: cookieFetch, onError: retryOnError, parser },
        schema: resourceSchema,
        getKey: (item) => item.id,
        onDelete: async ({ transaction }) => {
          const { original: r } = transaction.mutations[0]
          const result = await trpc.resources.delete.mutate({ id: r.id })
          return { txid: result.txid }
        },
      })
    ),

    propertiesCollection: createCollection(
      electricCollectionOptions({
        id: `properties-${projectId}`,
        shapeOptions: { url: url(`/api/properties`), fetchClient: cookieFetch, onError: retryOnError, parser },
        schema: propertySchema,
        getKey: (item) => item.id,
        onInsert: async ({ transaction }) => {
          const { modified: p } = transaction.mutations[0]
          const result = await trpc.properties.create.mutate({
            id: p.id, type: p.type, entity: p.entity, entity_id: p.entity_id,
            status_value: p.status_value, priority_value: p.priority_value,
            target_date: p.target_date, start_date: p.start_date,
            pending_task: p.pending_task, label_value: p.label_value,
          })
          return { txid: result.txid }
        },
        onUpdate: async ({ transaction }) => {
          const { modified: p } = transaction.mutations[0]
          const result = await trpc.properties.update.mutate({
            id: p.id,
            data: {
              status_value: p.status_value, priority_value: p.priority_value,
              target_date: p.target_date, start_date: p.start_date,
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
      })
    ),
  }

  cache.set(projectId, collections)
  return collections
}
