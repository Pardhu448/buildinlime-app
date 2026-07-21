import { router, authedProcedure, generateTxId } from "../lib/trpc"
import { TRPCError } from "@trpc/server"
import { eq, and, isNull, inArray } from "drizzle-orm"
import {
  projectsTable,
  buildUnitsTable,
  channelsTable,
  tasksTable,
  resourcesTable,
} from "../../database/schema/admin-schema"
import {
  createProjectInput,
  updateProjectInput,
  deleteProjectInput,
} from "@buildinlime/contracts"

export const projectsRouter = router({
  create: authedProcedure
    .input(createProjectInput)
    .mutation(async ({ ctx, input }) =>
      {
      // if (input.owner_id !== ctx.session.user.id) {
      //  throw new TRPCError({
      //    code: `FORBIDDEN`,
      //    message: `You can only create projects `,
      //  })
     // }

      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        const [newItem] = await tx
          .insert(projectsTable)
          .values(input)
          .returning()
        return { item: newItem, txid }
      })

      return result
    }),

  update: authedProcedure
    .input(updateProjectInput)
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

  /**
   * SOFT delete, owner-only, cascading to the whole subtree.
   *
   * Was a hard `DELETE` that leaned on `ON DELETE CASCADE` to take the build units,
   * channels, tasks and resources with it. Soft-deletion cannot lean on the FK — the
   * row still exists — so the cascade is done by hand here, in one transaction. It is
   * NOT optional: the child shapes (buildUnitsShape, channelsShape, tasksShape,
   * resourcesShape) filter on their OWN deleted_at and never look at the parent, so a
   * project whose build units were left undeleted would vanish while its build units
   * stayed visible via their own owner/member match.
   *
   * Messages are deliberately left untouched (redacted-in-place elsewhere); a deleted
   * project's channels drop out of channelsShape, so its messages simply become
   * unreachable rather than being destroyed — and the whole subtree is recoverable by
   * clearing deleted_at.
   */
  delete: authedProcedure
    .input(deleteProjectInput)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)

        const [project] = await tx
          .select()
          .from(projectsTable)
          .where(eq(projectsTable.id, input.id))

        if (!project || project.owner_id !== ctx.session.user.id) {
          throw new TRPCError({
            code: `NOT_FOUND`,
            message: `Project not found or you do not have permission to delete it`,
          })
        }

        // Already deleted — idempotent, so an outbox retry is harmless.
        if (project.deleted_at) return { item: project, txid }

        const stamp = { deleted_at: new Date(), deleted_by_id: ctx.session.user.id }

        const [deletedItem] = await tx
          .update(projectsTable)
          .set(stamp)
          .where(eq(projectsTable.id, input.id))
          .returning()

        // The build units of this project, as a subquery reused by the deeper
        // levels that only carry buildunit_id (channels, tasks).
        const buildUnitIds = tx
          .select({ id: buildUnitsTable.id })
          .from(buildUnitsTable)
          .where(eq(buildUnitsTable.project_id, input.id))

        await tx
          .update(buildUnitsTable)
          .set(stamp)
          .where(and(eq(buildUnitsTable.project_id, input.id), isNull(buildUnitsTable.deleted_at)))

        await tx
          .update(channelsTable)
          .set(stamp)
          .where(and(inArray(channelsTable.buildunit_id, buildUnitIds), isNull(channelsTable.deleted_at)))

        await tx
          .update(tasksTable)
          .set(stamp)
          .where(and(inArray(tasksTable.buildunit_id, buildUnitIds), isNull(tasksTable.deleted_at)))

        // resources carry a denormalized project_id, so no subquery needed.
        await tx
          .update(resourcesTable)
          .set(stamp)
          .where(and(eq(resourcesTable.project_id, input.id), isNull(resourcesTable.deleted_at)))

        return { item: deletedItem, txid }
      })

      return result
    }),
})
