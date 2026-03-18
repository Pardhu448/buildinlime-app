import { router, authedProcedure, generateTxId } from "../lib/trpc"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { eq, and, ilike } from "drizzle-orm"
import {
  buildUnitsTable,
  projectsTable,
  createBuildUnitSchema,
  updateBuildUnitSchema,
} from "../../database/schema/admin-schema"

export const buildUnitsRouter = router({
  create: authedProcedure
    .input(createBuildUnitSchema)
    .mutation(async ({ ctx, input }) => {
      // Only project owners can create build units
      const [project] = await ctx.db
        .select({ owner_id: projectsTable.owner_id })
        .from(projectsTable)
        .where(eq(projectsTable.id, input.project_id))
      if (!project) {
        throw new TRPCError({ code: `NOT_FOUND`, message: `Project not found` })
      }
      if (project.owner_id !== ctx.session.user.id) {
        throw new TRPCError({ code: `FORBIDDEN`, message: `Only project owners can create build units` })
      }

      // Prevent duplicate build unit names within the same project (case-insensitive)
      const [duplicate] = await ctx.db
        .select({ id: buildUnitsTable.id })
        .from(buildUnitsTable)
        .where(and(
          eq(buildUnitsTable.project_id, input.project_id),
          ilike(buildUnitsTable.name, input.name),
        ))
      if (duplicate) {
        throw new TRPCError({ code: `CONFLICT`, message: `A build unit named "${input.name}" already exists in this project` })
      }

      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        const [newItem] = await tx
          .insert(buildUnitsTable)
          .values(input)
          .returning()
        return { item: newItem, txid }
      })

      return result
    }),

  update: authedProcedure
    .input(
      z.object({
        id: z.string(),
        data: updateBuildUnitSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        const [updatedItem] = await tx
          .update(buildUnitsTable)
          .set(input.data)
          .where(
            and(
              eq(buildUnitsTable.id, input.id),
              eq(buildUnitsTable.owner_id, ctx.session.user.id)
            )
          )
          .returning()

        if (!updatedItem) {
          throw new TRPCError({
            code: `NOT_FOUND`,
            message: `Build unit not found or you do not have permission to update it`,
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
          .delete(buildUnitsTable)
          .where(
            and(
              eq(buildUnitsTable.id, input.id),
              eq(buildUnitsTable.owner_id, ctx.session.user.id)
            )
          )
          .returning()

        if (!deletedItem) {
          throw new TRPCError({
            code: `NOT_FOUND`,
            message: `Build unit not found or you do not have permission to delete it`,
          })
        }

        return { item: deletedItem, txid }
      })

      return result
    }),
})
