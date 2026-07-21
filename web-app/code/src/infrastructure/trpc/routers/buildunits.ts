import { router, authedProcedure, generateTxId } from "../lib/trpc"
import { TRPCError } from "@trpc/server"
import { eq, and, ilike, isNull } from "drizzle-orm"
import {
  buildUnitsTable,
  projectsTable,
  channelsTable,
  tasksTable,
  resourcesTable,
} from "../../database/schema/admin-schema"
import {
  createBuildUnitInput,
  updateBuildUnitInput,
  deleteBuildUnitInput,
} from "@buildinlime/contracts"

export const buildUnitsRouter = router({
  create: authedProcedure
    .input(createBuildUnitInput)
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
    .input(updateBuildUnitInput)
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

  /**
   * SOFT delete, owner-only, cascading to its channels, tasks and resources. Same
   * design as projects.delete — see the long note there for why the cascade is done
   * by hand rather than left to a FK, and why messages are untouched.
   */
  delete: authedProcedure
    .input(deleteBuildUnitInput)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)

        const [buildUnit] = await tx
          .select()
          .from(buildUnitsTable)
          .where(eq(buildUnitsTable.id, input.id))

        if (!buildUnit || buildUnit.owner_id !== ctx.session.user.id) {
          throw new TRPCError({
            code: `NOT_FOUND`,
            message: `Build unit not found or you do not have permission to delete it`,
          })
        }

        if (buildUnit.deleted_at) return { item: buildUnit, txid }

        const stamp = { deleted_at: new Date(), deleted_by_id: ctx.session.user.id }

        const [deletedItem] = await tx
          .update(buildUnitsTable)
          .set(stamp)
          .where(eq(buildUnitsTable.id, input.id))
          .returning()

        await tx
          .update(channelsTable)
          .set(stamp)
          .where(and(eq(channelsTable.buildunit_id, input.id), isNull(channelsTable.deleted_at)))

        await tx
          .update(tasksTable)
          .set(stamp)
          .where(and(eq(tasksTable.buildunit_id, input.id), isNull(tasksTable.deleted_at)))

        await tx
          .update(resourcesTable)
          .set(stamp)
          .where(and(eq(resourcesTable.buildunit_id, input.id), isNull(resourcesTable.deleted_at)))

        return { item: deletedItem, txid }
      })

      return result
    }),
})
