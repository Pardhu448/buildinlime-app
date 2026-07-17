import { router, authedProcedure, generateTxId } from "../lib/trpc"
import { TRPCError } from "@trpc/server"
import { eq } from "drizzle-orm"
import { teamsTable, projectsTable } from "../../database/schema/admin-schema"
import {
  createTeamInput,
  updateTeamInput,
  deleteTeamInput,
} from "@buildinlime/contracts"

export const teamsRouter = router({
  create: authedProcedure
    .input(createTeamInput)
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
        // ON CONFLICT DO NOTHING — outbox retries become idempotent.
        const [inserted] = await tx
          .insert(teamsTable)
          .values({ ...input, owner_id: ctx.session.user.id })
          .onConflictDoNothing()
          .returning()
        if (inserted) return { item: inserted, txid }
        const [existing] = await tx
          .select()
          .from(teamsTable)
          .where(eq(teamsTable.id, input.id))
        return { item: existing, txid }
      })
      return result
    }),

  update: authedProcedure
    .input(updateTeamInput)
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
    .input(deleteTeamInput)
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
