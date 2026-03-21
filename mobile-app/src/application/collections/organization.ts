import { createCollection } from "@tanstack/react-db"
import { electricCollectionOptions } from "@tanstack/electric-db-collection"
import { z } from "zod"
import {
  CHANNEL_NAMES,
  MEMBERSHIP_ROLES,
} from "@buildinlime/domain-types"
import { createCookieFetch } from "../../infrastructure/auth/cookie-fetch"
import { trpc } from "../../infrastructure/trpc/client"

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000"
const cookieFetch = createCookieFetch()

const retryOnError = async (error: Error) => {
  const delay = error.message.includes("401") ? 2000 : 5000
  await new Promise((resolve) => setTimeout(resolve, delay))
}

const coerceBool = (v: unknown) => v === "true" || v === true
const unwrapJsonb = (v: unknown) =>
  typeof v === "string" && v.startsWith('"') ? JSON.parse(v) : v

// --- Schemas (mirror web app's organization-tables Zod shapes) ---

const selectProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  owner_id: z.string(),
  priority: z.preprocess(unwrapJsonb, z.enum(["High", "Mid", "Low"]).nullish()),
  target_date: z.string().nullable().optional(),
  status_percent: z.string().nullable().optional(),
  created_at: z.union([z.string(), z.date()]).optional(),
})

const selectBuildUnitSchema = z.object({
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

const selectChannelSchema = z.object({
  id: z.string(),
  name: z.preprocess(unwrapJsonb, z.enum(CHANNEL_NAMES)),
  description: z.string().nullable().optional(),
  buildunit_id: z.string(),
  owner_id: z.string(),
  created_at: z.union([z.string(), z.date()]).optional(),
})

const selectMembershipSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  channel_id: z.string(),
  buildunit_id: z.string(),
  project_id: z.string(),
  member_flag: z.preprocess(coerceBool, z.boolean()),
  role: z.enum(MEMBERSHIP_ROLES).default(`viewer`),
  created_at: z.union([z.string(), z.date()]).optional(),
})

// --- Collections ---

export const projectsCollection = createCollection(
  electricCollectionOptions({
    id: "projects",
    shapeOptions: {
      url: `${apiUrl}/api/projects`,
      fetchClient: cookieFetch,
      onError: retryOnError,
      parser: { timestamptz: (d: string) => new Date(d) },
    },
    schema: selectProjectSchema,
    getKey: (item) => item.id,
    onInsert: async ({ transaction }) => {
      const { modified: p } = transaction.mutations[0]
      const result = await trpc.projects.create.mutate({
        id: p.id, name: p.name, description: p.description, owner_id: p.owner_id,
      })
      return { txid: result.txid }
    },
    onUpdate: async ({ transaction }) => {
      const { modified: p } = transaction.mutations[0]
      const result = await trpc.projects.update.mutate({
        id: p.id, data: { name: p.name, description: p.description },
      })
      return { txid: result.txid }
    },
    onDelete: async ({ transaction }) => {
      const { original: p } = transaction.mutations[0]
      const result = await trpc.projects.delete.mutate({ id: p.id })
      return { txid: result.txid }
    },
  })
)

export const buildUnitsCollection = createCollection(
  electricCollectionOptions({
    id: "build-units",
    shapeOptions: {
      url: `${apiUrl}/api/buildunits`,
      fetchClient: cookieFetch,
      onError: retryOnError,
      parser: { timestamptz: (d: string) => new Date(d) },
    },
    schema: selectBuildUnitSchema,
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
)

export const channelsCollection = createCollection(
  electricCollectionOptions({
    id: "channels",
    shapeOptions: {
      url: `${apiUrl}/api/channels`,
      fetchClient: cookieFetch,
      onError: retryOnError,
      parser: { timestamptz: (d: string) => new Date(d) },
    },
    schema: selectChannelSchema,
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
)

export const membershipsCollection = createCollection(
  electricCollectionOptions({
    id: "memberships",
    shapeOptions: {
      url: `${apiUrl}/api/memberships`,
      fetchClient: cookieFetch,
      onError: retryOnError,
      parser: { timestamptz: (d: string) => new Date(d) },
    },
    schema: selectMembershipSchema,
    getKey: (item) => item.id,
  })
)
