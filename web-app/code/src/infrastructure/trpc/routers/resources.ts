import { router, authedProcedure, generateTxId } from "../lib/trpc"
import { TRPCError } from "@trpc/server"
import { eq } from "drizzle-orm"
import { resourcesTable, tasksTable } from "../../database/schema/admin-schema"
import { deleteResourceInput } from "@buildinlime/contracts"

export const resourcesRouter = router({
  /**
   * SOFT delete. Nothing hangs off a resource, so it is filtered out of the Electric
   * shape (`deleted_at IS NULL` in routes/api/resources.ts) and ceases to exist for
   * every client.
   *
   * THE FILE ON DISK IS DELIBERATELY LEFT ALONE. This used to fs.unlink() the bytes
   * and remove the row. Now that the row survives, unlinking would make the delete
   * irreversible in the one dimension that actually matters — the metadata could be
   * restored and would point at nothing. resources_raw still holds the path, so a
   * purge job can reclaim the bytes later, deliberately. Deleting them here would
   * quietly turn a soft delete back into a hard one.
   */
  delete: authedProcedure
    .input(deleteResourceInput)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)

        const [resource] = await tx
          .select()
          .from(resourcesTable)
          .where(eq(resourcesTable.id, input.id))

        if (!resource) {
          throw new TRPCError({
            code: `NOT_FOUND`,
            message: `Resource not found`,
          })
        }

        // Uploader, or the creator of the task the file is attached to. Enforced
        // here, not by hiding the button — the previous hard delete had no check at
        // all, so any authenticated user could delete anyone's file (and its bytes)
        // by calling this endpoint.
        //
        // The task creator is included because tasks.delete ALREADY soft-deletes
        // every attachment on the task, whoever uploaded it. Uploader-only here
        // meant you could destroy someone's file by deleting the whole task, but not
        // remove it one by one — the strictness bought nothing and just stranded the
        // task's owner with files they couldn't clear.
        let canDelete = resource.createdby_id === ctx.session.user.id

        if (!canDelete && resource.task_id) {
          const [task] = await tx
            .select({ createdby_id: tasksTable.createdby_id })
            .from(tasksTable)
            .where(eq(tasksTable.id, resource.task_id))
          canDelete = task?.createdby_id === ctx.session.user.id
        }

        if (!canDelete) {
          throw new TRPCError({
            code: `FORBIDDEN`,
            message: `Only the uploader or the task's creator can delete this file`,
          })
        }

        // Already deleted — idempotent, so an outbox retry is harmless.
        if (resource.deleted_at) return { item: resource, txid }

        const [deletedItem] = await tx
          .update(resourcesTable)
          .set({ deleted_at: new Date(), deleted_by_id: ctx.session.user.id })
          .where(eq(resourcesTable.id, input.id))
          .returning()

        return { item: deletedItem, txid }
      })

      return result
    }),
})
