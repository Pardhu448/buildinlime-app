import { router, authedProcedure, generateTxId } from "../lib/trpc"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { eq } from "drizzle-orm"
import {
  messagesTable,
  createMessageSchema,
} from "../../database/schema/admin-schema"

export const messagesRouter = router({
  create: authedProcedure
    .input(createMessageSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        const [newItem] = await tx
          .insert(messagesTable)
          .values(input)
          .returning()
        return { item: newItem, txid }
      })

      return result
    }),

  delete: authedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        const [deletedItem] = await tx
          .delete(messagesTable)
          .where(eq(messagesTable.id, input.id))
          .returning()

        if (!deletedItem) {
          throw new TRPCError({ code: `NOT_FOUND`, message: `Message not found` })
        }

        return { item: deletedItem, txid }
      })

      return result
    }),
})
