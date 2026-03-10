import { createCollection } from "@tanstack/react-db"
import { electricCollectionOptions } from "@tanstack/electric-db-collection"
import { z } from "zod"
import {
  selectProjectSchema,
  selectBuildUnitSchema,
  selectChannelSchema,
  selectMembershipSchema,
  selectPropertySchema,
  selectTaskSchema,
  selectResourceSchema,
  selectMessageSchema,
  selectTeamSchema,
  PROPERTY_TYPES,
  ENTITY_TYPES,
  STATUS_VALUES,
  PRIORITY_VALUES,
} from "../schema/admin-schema"
import { trpc } from "../../trpc/lib/trpc-client"

// Retry handler for Electric shape fetch errors.
// Returning (not throwing) causes Electric to retry the shape fetch.
// - 401: session not ready yet → retry after 2s
// - other errors: retry after 5s
const retryOnError = async (error: Error) => {
  const delay = error.message.includes(`401`) ? 2000 : 5000
  await new Promise((resolve) => setTimeout(resolve, delay))
}

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

// Electric returns boolean columns as the string "true"/"false".
const coerceBool = (v: unknown) => v === "true" || v === true

const electricTaskSchema = selectTaskSchema.extend({
  completed: z.preprocess(coerceBool, z.boolean()),
})

// Electric returns the actual DB column names (snake_case), not the camelCase
// JS property names that drizzle-zod generates from the auth-schema users table.
// Note: Electric returns boolean columns as the string "true"/"false", so
// email_verified needs z.preprocess to coerce before boolean validation.
const electricUsersSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  email_verified: z.preprocess((v) => v === "true" || v === true, z.boolean()).optional(),
  image: z.string().nullable().optional(),
  created_at: z.union([z.string(), z.date()]).optional(),
  updated_at: z.union([z.string(), z.date()]).optional(),
})

const electricMembershipSchema = selectMembershipSchema.extend({
  member_flag: z.preprocess(coerceBool, z.boolean()),
})

const origin = typeof window !== `undefined`
  ? window.location.origin
  : `https://localhost:5173`

export const usersCollection = createCollection(
  electricCollectionOptions({
    id: `users`,
    shapeOptions: {
      url: new URL(`/api/users`, origin).toString(),
      onError: retryOnError,
      parser: {
        timestamptz: (date: string) => {
          return new Date(date)
        },
      },
    },
    schema: electricUsersSchema,
    getKey: (item) => item.id,
  })
)

export const membershipsCollection = createCollection(
  electricCollectionOptions({
    id: `memberships`,
    shapeOptions: {
      url: new URL(`/api/memberships`, origin).toString(),
      onError: retryOnError,
      parser: {
        timestamptz: (date: string) => new Date(date),
      },
    },
    schema: electricMembershipSchema,
    getKey: (item) => item.id,
  })
)

export const projectsCollection = createCollection(
  electricCollectionOptions({
    id: `projects`,
    shapeOptions: {
      url: new URL(`/api/projects`, origin).toString(),
      onError: retryOnError,
      parser: {
        timestamptz: (date: string) => {
          return new Date(date)
        },
      },
    },
    schema: selectProjectSchema,
    getKey: (item) => item.id,
    onInsert: async ({ transaction }) => {
      const { modified: newProject } = transaction.mutations[0]
      const result = await trpc.projects.create.mutate({
        id: newProject.id,
        name: newProject.name,
        description: newProject.description,
        owner_id: newProject.owner_id,
      })

      return { txid: result.txid }
    },
    onUpdate: async ({ transaction }) => {
      const { modified: updatedProject } = transaction.mutations[0]
      const result = await trpc.projects.update.mutate({
        id: updatedProject.id,
        data: {
          name: updatedProject.name,
          description: updatedProject.description,
        },
      })

      return { txid: result.txid }
    },
    onDelete: async ({ transaction }) => {
      const { original: deletedProject } = transaction.mutations[0]
      const result = await trpc.projects.delete.mutate({
        id: deletedProject.id,
      })

      return { txid: result.txid }
    },
  })
)

export const buildUnitsCollection = createCollection(
  electricCollectionOptions({
    id: `build-units`,
    shapeOptions: {
      url: new URL(`/api/buildunits`, origin).toString(),
      onError: retryOnError,
      parser: {
        timestamptz: (date: string) => {
          return new Date(date)
        },
      },
    },
    schema: selectBuildUnitSchema,
    getKey: (item) => item.id,
    onInsert: async ({ transaction }) => {
      const { modified: newBuildUnit } = transaction.mutations[0]
      const result = await trpc.buildUnits.create.mutate({
        id: newBuildUnit.id,
        name: newBuildUnit.name,
        description: newBuildUnit.description,
        project_id: newBuildUnit.project_id,
        owner_id: newBuildUnit.owner_id,
      })

      return { txid: result.txid }
    },
    onUpdate: async ({ transaction }) => {
      const { modified: updatedBuildUnit } = transaction.mutations[0]
      const result = await trpc.buildUnits.update.mutate({
        id: updatedBuildUnit.id,
        data: {
          name: updatedBuildUnit.name,
          description: updatedBuildUnit.description,
        },
      })

      return { txid: result.txid }
    },
    onDelete: async ({ transaction }) => {
      const { original: deletedBuildUnit } = transaction.mutations[0]
      const result = await trpc.buildUnits.delete.mutate({
        id: deletedBuildUnit.id,
      })

      return { txid: result.txid }
    },
  })
)

export const channelsCollection = createCollection(
  electricCollectionOptions({
    id: `channels`,
    shapeOptions: {
      url: new URL(`/api/channels`, origin).toString(),
      onError: retryOnError,
      parser: {
        timestamptz: (date: string) => {
          return new Date(date)
        },
      },
    },
    schema: selectChannelSchema,
    getKey: (item) => item.id,
    onInsert: async ({ transaction }) => {
      const { modified: newChannel } = transaction.mutations[0]
      const result = await trpc.channels.create.mutate({
        id: newChannel.id,
        name: newChannel.name,
        description: newChannel.description,
        buildunit_id: newChannel.buildunit_id,
        owner_id: newChannel.owner_id,
      })

      return { txid: result.txid }
    },
    onUpdate: async ({ transaction }) => {
      const { modified: updatedChannel } = transaction.mutations[0]
      const result = await trpc.channels.update.mutate({
        id: updatedChannel.id,
        data: {
          name: updatedChannel.name,
          description: updatedChannel.description,
        },
      })

      return { txid: result.txid }
    },
    onDelete: async ({ transaction }) => {
      const { original: deletedChannel } = transaction.mutations[0]
      const result = await trpc.channels.delete.mutate({
        id: deletedChannel.id,
      })

      return { txid: result.txid }
    },
  })
)

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

export const teamsCollection = createCollection(
  electricCollectionOptions({
    id: `teams`,
    shapeOptions: {
      url: new URL(`/api/teams`, origin).toString(),
      onError: retryOnError,
      parser: {
        timestamptz: (date: string) => new Date(date),
      },
    },
    schema: selectTeamSchema,
    getKey: (item) => item.id,
    onInsert: async ({ transaction }) => {
      const { modified: newTeam } = transaction.mutations[0]
      const result = await trpc.teams.create.mutate({
        id: newTeam.id,
        name: newTeam.name,
        description: newTeam.description,
      })
      return { txid: result.txid }
    },
    onDelete: async ({ transaction }) => {
      const { original: deletedTeam } = transaction.mutations[0]
      const result = await trpc.teams.delete.mutate({ id: deletedTeam.id })
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
