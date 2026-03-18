import { router, authedProcedure, generateTxId } from "../lib/trpc"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { eq, and } from "drizzle-orm"
import {
  teamsTable,
  projectsTable,
  createTeamSchema,
  updateTeamSchema,
} from "../../database/schema/admin-schema"

export const teamsRouter = router({
  create: authedProcedure
    .input(createTeamSchema)
    .mutation(async ({ ctx, input }) => {
      // Only project owners can create teams
      const [project] = await ctx.db
        .select({ owner_id: projectsTable.owner_id })
        .from(projectsTable)
        .where(eq(projectsTable.id, input.project_id))
      if (!project) {
        throw new TRPCError({ code: `NOT_FOUND`, message: `Project not found` })
      }
      if (project.owner_id !== ctx.session.user.id) {
        throw new TRPCError({ code: `FORBIDDEN`, message: `Only project owners can create teams` })
      }

      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        const [newItem] = await tx
          .insert(teamsTable)
          .values({ ...input, owner_id: ctx.session.user.id })
          .returning()
        return { item: newItem, txid }
      })
      return result
    }),

  update: authedProcedure
    .input(z.object({ id: z.string(), data: updateTeamSchema }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        const [updatedItem] = await tx
          .update(teamsTable)
          .set(input.data)
          .where(eq(teamsTable.id, input.id))
          .returning()

        if (!updatedItem) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" })
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
          .delete(teamsTable)
          .where(eq(teamsTable.id, input.id))
          .returning()

        if (!deletedItem) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" })
        }
        return { item: deletedItem, txid }
      })
      return result
    }),
})
