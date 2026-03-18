import { createCollection } from "@tanstack/react-db"
import { electricCollectionOptions } from "@tanstack/electric-db-collection"
import { z } from "zod"
import { selectTeamSchema } from "%/infrastructure/database/schema/admin-schema"
import { trpc } from "%/infrastructure/trpc/lib/trpc-client"
import { retryOnError, origin } from "./_shared"

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

const electricTeamSchema = selectTeamSchema.extend({
  member_ids: z.preprocess(
    (v) => (typeof v === "string" ? JSON.parse(v) : v),
    z.array(z.string()).default([])
  ),
})

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
    schema: electricTeamSchema,
    getKey: (item) => item.id,
    onInsert: async ({ transaction }) => {
      const { modified: newTeam } = transaction.mutations[0]
      const result = await trpc.teams.create.mutate({
        id: newTeam.id,
        name: newTeam.name,
        description: newTeam.description,
        owner_id: newTeam.owner_id,
        project_id: newTeam.project_id,
        member_ids: newTeam.member_ids ?? [],
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
