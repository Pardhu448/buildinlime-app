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

const selectProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  owner_id: z.string(),
  created_at: z.union([z.string(), z.date()]).optional(),
  updated_at: z.union([z.string(), z.date()]).optional(),
})

/**
 * Always-active collection — syncs all projects the user has access to.
 * This is the only collection active before a project is selected.
 */
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
