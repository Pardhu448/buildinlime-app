import {
  createCollection,
  localOnlyCollectionOptions,
} from "@tanstack/react-db"
import { z } from "zod"

const authStateSchema = z.object({
  id: z.string(),
  session: z.any().nullable(),
  user: z.any().nullable(),
})

export const authStateCollection = createCollection(
  localOnlyCollectionOptions({
    id: `auth-state`,
    getKey: (item) => item.id,
    schema: authStateSchema,
  })
)