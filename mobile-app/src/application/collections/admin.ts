import { createCollection } from "@tanstack/react-db"
import { electricCollectionOptions } from "@tanstack/electric-db-collection"
import { z } from "zod"
import { createCookieFetch } from "../../infrastructure/auth/cookie-fetch"
import { trpc } from "../../infrastructure/trpc/client"

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000"
const cookieFetch = createCookieFetch()

const retryOnError = async (error: Error) => {
  const delay = error.message.includes("401") ? 2000 : 5000
  await new Promise((resolve) => setTimeout(resolve, delay))
}

const coerceBool = (v: unknown) => v === "true" || v === true

// --- Schemas ---

const electricUsersSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  email_verified: z.preprocess(coerceBool, z.boolean()).optional(),
  image: z.string().nullable().optional(),
  created_at: z.union([z.string(), z.date()]).optional(),
  updated_at: z.union([z.string(), z.date()]).optional(),
})

const selectTeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  created_at: z.union([z.string(), z.date()]).optional(),
  updated_at: z.union([z.string(), z.date()]).optional(),
})

// --- Collections ---

export const usersCollection = createCollection(
  electricCollectionOptions({
    id: "users",
    shapeOptions: {
      url: `${apiUrl}/api/users`,
      fetchClient: cookieFetch,
      onError: retryOnError,
      parser: { timestamptz: (d: string) => new Date(d) },
    },
    schema: electricUsersSchema,
    getKey: (item) => item.id,
  })
)

export const teamsCollection = createCollection(
  electricCollectionOptions({
    id: "teams",
    shapeOptions: {
      url: `${apiUrl}/api/teams`,
      fetchClient: cookieFetch,
      onError: retryOnError,
      parser: { timestamptz: (d: string) => new Date(d) },
    },
    schema: selectTeamSchema,
    getKey: (item) => item.id,
    onInsert: async ({ transaction }) => {
      const { modified: t } = transaction.mutations[0]
      const result = await trpc.teams.create.mutate({
        id: t.id, name: t.name, description: t.description,
      })
      return { txid: result.txid }
    },
    onDelete: async ({ transaction }) => {
      const { original: t } = transaction.mutations[0]
      const result = await trpc.teams.delete.mutate({ id: t.id })
      return { txid: result.txid }
    },
  })
)
