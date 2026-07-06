import { router, authedProcedure, generateTxId } from "../lib/trpc"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { eq } from "drizzle-orm"
import {
  propertiesTable,
  createPropertySchema,
  updatePropertySchema,
} from "../../database/schema/admin-schema"

export const propertiesRouter = router({
  create: authedProcedure
    .input(createPropertySchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        // ON CONFLICT DO NOTHING — outbox retries become idempotent.
        // createdby_id is stamped server-side (never trusted from the client)
        // so the properties shape's `OR createdby_id = me` owner escape hatch is
        // reliable.
        const [inserted] = await tx
          .insert(propertiesTable)
          .values({ ...input, createdby_id: ctx.session.user.id })
          .onConflictDoNothing()
          .returning()
        if (inserted) return { item: inserted, txid }
        const [existing] = await tx
          .select()
          .from(propertiesTable)
          .where(eq(propertiesTable.id, input.id))
        return { item: existing, txid }
      })

      return result
    }),

  update: authedProcedure
    .input(
      z.object({
        id: z.string(),
        data: updatePropertySchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        const [updatedItem] = await tx
          .update(propertiesTable)
          .set(input.data)
          .where(eq(propertiesTable.id, input.id))
          .returning()

        if (!updatedItem) {
          throw new TRPCError({
            code: `NOT_FOUND`,
            message: `Property not found`,
          })
        }

        return { item: updatedItem, txid }
      })

      return result
    }),

  delete: authedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        const [deletedItem] = await tx
          .delete(propertiesTable)
          .where(eq(propertiesTable.id, input.id))
          .returning()

        if (!deletedItem) {
          throw new TRPCError({
            code: `NOT_FOUND`,
            message: `Property not found`,
          })
        }

        return { item: deletedItem, txid }
      })

      return result
    }),
})
