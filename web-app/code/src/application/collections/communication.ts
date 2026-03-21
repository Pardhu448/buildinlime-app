import { createCollection } from "@tanstack/react-db"
import { electricCollectionOptions } from "@tanstack/electric-db-collection"
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
import { trpc } from "%/infrastructure/trpc/lib/trpc-client"
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

export const tasksCollection = createCollection(
  electricCollectionOptions({
    id: `tasks`,
    shapeOptions: {
      url: new URL(`/api/tasks`, origin).toString(),
      onError: retryOnError,
      parser: {
        timestamptz: (date: string) => {
          return new Date(date)
        },
      },
    },
    schema: electricTaskSchema,
    getKey: (item) => item.id,
    onInsert: async ({ transaction }) => {
      const { modified: newTask } = transaction.mutations[0]
      const result = await trpc.tasks.create.mutate({
        id: newTask.id,
        name: newTask.name,
        description: newTask.description,
        completed: newTask.completed,
        channel_id: newTask.channel_id,
        buildunit_id: newTask.buildunit_id,
        createdby_id: newTask.createdby_id,
        assignee_id: newTask.assignee_id ?? null,
      })

      return { txid: result.txid }
    },
    onUpdate: async ({ transaction }) => {
      const { modified: updatedTask } = transaction.mutations[0]
      const result = await trpc.tasks.update.mutate({
        id: updatedTask.id,
        data: {
          name: updatedTask.name,
          description: updatedTask.description,
          completed: coerceBool(updatedTask.completed),
          assignee_id: updatedTask.assignee_id,
        },
      })

      return { txid: result.txid }
    },
    onDelete: async ({ transaction }) => {
      const { original: deletedTask } = transaction.mutations[0]
      const result = await trpc.tasks.delete.mutate({
        id: deletedTask.id,
      })

      return { txid: result.txid }
    },
  })
)

export const resourcesCollection = createCollection(
  electricCollectionOptions({
    id: `resources`,
    shapeOptions: {
      url: new URL(`/api/resources`, origin).toString(),
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
    onDelete: async ({ transaction }) => {
      const { original: deletedResource } = transaction.mutations[0]
      const result = await trpc.resources.delete.mutate({
        id: deletedResource.id,
      })
      return { txid: result.txid }
    },
  })
)

export const propertiesCollection = createCollection(
  electricCollectionOptions({
    id: `properties`,
    shapeOptions: {
      url: new URL(`/api/properties`, origin).toString(),
      onError: retryOnError,
      parser: {
        timestamptz: (date: string) => {
          return new Date(date)
        },
      },
    },
    schema: electricPropertySchema,
    getKey: (item) => item.id,
    onInsert: async ({ transaction }) => {
      const { modified: newProperty } = transaction.mutations[0]
      const result = await trpc.properties.create.mutate({
        id: newProperty.id,
        type: newProperty.type,
        entity: newProperty.entity,
        entity_id: newProperty.entity_id,
        status_value: newProperty.status_value,
        priority_value: newProperty.priority_value,
        target_date: newProperty.target_date,
        start_date: newProperty.start_date,
        pending_task: newProperty.pending_task,
        label_value: newProperty.label_value,
      })

      return { txid: result.txid }
    },
    onUpdate: async ({ transaction }) => {
      const { modified: updatedProperty } = transaction.mutations[0]
      const result = await trpc.properties.update.mutate({
        id: updatedProperty.id,
        data: {
          status_value: updatedProperty.status_value,
          priority_value: updatedProperty.priority_value,
          target_date: updatedProperty.target_date,
          start_date: updatedProperty.start_date,
          pending_task: updatedProperty.pending_task,
        },
      })

      return { txid: result.txid }
    },
    onDelete: async ({ transaction }) => {
      const { original: deletedProperty } = transaction.mutations[0]
      const result = await trpc.properties.delete.mutate({
        id: deletedProperty.id,
      })

      return { txid: result.txid }
    },
  })
)

export const messagesCollection = createCollection(
  electricCollectionOptions({
    id: `messages`,
    shapeOptions: {
      url: new URL(`/api/messages`, origin).toString(),
      onError: retryOnError,
      parser: {
        timestamptz: (date: string) => {
          return new Date(date)
        },
      },
    },
    schema: selectMessageSchema,
    getKey: (item) => item.id,
    onInsert: async ({ transaction }) => {
      const { modified: newMessage } = transaction.mutations[0]
      const result = await trpc.messages.create.mutate({
        id: newMessage.id,
        text: newMessage.text,
        channel_id: newMessage.channel_id,
        buildunit_id: newMessage.buildunit_id,
        project_id: newMessage.project_id,
        createdby_id: newMessage.createdby_id,
        mention_ids: newMessage.mention_ids,
        resource_ids: newMessage.resource_ids,
        parent_id: newMessage.parent_id ?? null,
      })

      return { txid: result.txid }
    },
    onDelete: async ({ transaction }) => {
      const { original: deletedMessage } = transaction.mutations[0]
      const result = await trpc.messages.delete.mutate({
        id: deletedMessage.id,
      })

      return { txid: result.txid }
    },
  })
)
