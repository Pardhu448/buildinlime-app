import { router, authedProcedure, generateTxId } from "../lib/trpc"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { eq, and } from "drizzle-orm"
import {
  projectsTable,
  createProjectSchema,
  updateProjectSchema,
} from "../../database/schema/admin-schema"

export const projectsRouter = router({
  create: authedProcedure
    .input(createProjectSchema)
    .mutation(async ({ ctx, input }) => 
      {
      //if (input.owner_id !== ctx.session.user.id) {
      //  throw new TRPCError({
      //    code: `FORBIDDEN`,
      //    message: `You can only create projects `,
      //  })
     // }

      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        // ON CONFLICT DO NOTHING — outbox retries become idempotent.
        const [inserted] = await tx
          .insert(projectsTable)
          .values(input)
          .onConflictDoNothing()
          .returning()
        if (inserted) return { item: inserted, txid }
        const [existing] = await tx
          .select()
          .from(projectsTable)
          .where(eq(projectsTable.id, input.id))
        return { item: existing, txid }
      })

      return result
    }),

  update: authedProcedure
    .input(
      z.object({
        id: z.string(),
        data: updateProjectSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        const [updatedItem] = await tx
          .update(projectsTable)
          .set(input.data)
          .where(
            and(
              eq(projectsTable.id, input.id),
              eq(projectsTable.owner_id, ctx.session.user.id)
            )
          )
          .returning()

        if (!updatedItem) {
          throw new TRPCError({
            code: `NOT_FOUND`,
            message: `Project not found or you do not have permission to update it`,
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
          .delete(projectsTable)
          .where(
            and(
              eq(projectsTable.id, input.id),
              eq(projectsTable.owner_id, ctx.session.user.id)
            )
          )
          .returning()

        if (!deletedItem) {
          throw new TRPCError({
            code: `NOT_FOUND`,
            message: `Project not found or you do not have permission to delete it`,
          })
        }

        return { item: deletedItem, txid }
      })

      return result
    }),
})
