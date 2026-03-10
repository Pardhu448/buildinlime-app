import { router, authedProcedure, generateTxId } from "./lib/trpc"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { eq } from "drizzle-orm"
import { promises as fs } from "node:fs"
import {
  resourcesTable,
  resourcesRawTable,
} from "../database/schema/admin-schema"

export const resourcesRouter = router({
  delete: authedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Look up the raw record first to get the storage path
      const rawRecords = await ctx.db
        .select()
        .from(resourcesRawTable)
        .where(eq(resourcesRawTable.resource_id, input.id))

      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        const [deletedItem] = await tx
          .delete(resourcesTable)
          .where(eq(resourcesTable.id, input.id))
          .returning()

        if (!deletedItem) {
          throw new TRPCError({
            code: `NOT_FOUND`,
            message: `Resource not found`,
          })
        }

        return { item: deletedItem, txid }
      })

      // Delete the file from disk after the DB transaction succeeds
      for (const raw of rawRecords) {
        try {
          await fs.unlink(raw.storage_path)
          // Try to remove the parent directory if empty
          const dir = raw.storage_path.substring(0, raw.storage_path.lastIndexOf("/"))
          await fs.rmdir(dir).catch(() => {/* ignore if not empty */})
        } catch {
          // File may already be gone — not a fatal error
        }
      }

      return result
    }),
})
