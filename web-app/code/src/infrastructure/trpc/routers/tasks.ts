import { router, authedProcedure, generateTxId } from "../lib/trpc"
import { TRPCError } from "@trpc/server"
import { eq } from "drizzle-orm"
import { tasksTable, resourcesTable } from "../../database/schema/admin-schema"
import {
  createTaskInput,
  updateTaskInput,
  deleteTaskInput,
} from "@buildinlime/contracts"

/**
 * Did this error come from tasks_channel_name_unique — i.e. a duplicate task name
 * within a channel?
 *
 * Postgres reports a unique violation as SQLSTATE 23505. Matching the constraint
 * name as well keeps this from mistaking some OTHER unique violation on the table
 * for a name collision.
 *
 * Mapping it to a CONFLICT is not cosmetic. The offline outbox retries retriable
 * errors FOREVER and drains strictly in order, so a raw 500 here would wedge the
 * queue and stall every write behind it. CONFLICT is in both clients'
 * non-retriable sets, so it fails fast instead.
 */
function isTaskNameConflict(err: unknown): boolean {
  const e = err as { code?: string; constraint?: string; cause?: unknown }
  if (e?.code === `23505` && e?.constraint === `tasks_channel_name_unique`) return true
  // node-postgres errors are sometimes wrapped by the driver.
  const cause = e?.cause as { code?: string; constraint?: string } | undefined
  return cause?.code === `23505` && cause?.constraint === `tasks_channel_name_unique`
}

export const tasksRouter = router({
  create: authedProcedure
    .input(createTaskInput)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        // ON CONFLICT DO NOTHING makes retries from the offline outbox safe:
        // if a previous attempt succeeded but the response was lost, the
        // second call returns the existing row without raising a duplicate-key error.
        //
        // TARGETED at the primary key, deliberately. An untargeted DO NOTHING would
        // ALSO swallow a tasks_channel_name_unique violation: the insert would do
        // nothing, the select-by-id below would find nothing, and the client would
        // get `item: undefined` — a duplicate name failing silently. Scoping it to
        // `id` keeps the retry-idempotency and lets a NAME collision raise, so it
        // can be reported as a CONFLICT.
        let inserted
        try {
          ;[inserted] = await tx
            .insert(tasksTable)
            .values(input)
            .onConflictDoNothing({ target: tasksTable.id })
            .returning()
        } catch (err) {
          if (isTaskNameConflict(err)) {
            throw new TRPCError({
              code: `CONFLICT`,
              message: `A task named "${input.name}" already exists in this channel`,
            })
          }
          throw err
        }
        if (inserted) return { item: inserted, txid }
        const [existing] = await tx
          .select()
          .from(tasksTable)
          .where(eq(tasksTable.id, input.id))
        return { item: existing, txid }
      })

      return result
    }),

  update: authedProcedure
    .input(updateTaskInput)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)

        const [task] = await tx
          .select()
          .from(tasksTable)
          .where(eq(tasksTable.id, input.id))

        if (!task) {
          throw new TRPCError({ code: `NOT_FOUND`, message: `Task not found` })
        }

        // Only the creator may (re)assign. Enforced here, not just by hiding the
        // button: the client-side member filter in AssignedToSection was the ONLY
        // constraint, and a hidden button stops nobody from calling the endpoint.
        const reassigning =
          input.data.assignee_id !== undefined &&
          input.data.assignee_id !== task.assignee_id
        if (reassigning && task.createdby_id !== ctx.session.user.id) {
          throw new TRPCError({
            code: `FORBIDDEN`,
            message: `Only the task's creator can assign it`,
          })
        }

        // A rename can collide with a sibling task's name just as a create can.
        // Unlike a create, this one is NOT auto-suffixed: a rename is interactive —
        // the user is right there and can pick another name — so tell them.
        let updatedItem
        try {
          ;[updatedItem] = await tx
            .update(tasksTable)
            .set(input.data)
            .where(eq(tasksTable.id, input.id))
            .returning()
        } catch (err) {
          if (isTaskNameConflict(err)) {
            throw new TRPCError({
              code: `CONFLICT`,
              message: `A task named "${input.data.name}" already exists in this channel`,
            })
          }
          throw err
        }

        return { item: updatedItem, txid }
      })

      return result
    }),

  /**
   * SOFT delete. Nothing hangs off a task the way replies hang off a message, so it
   * is simply filtered out of the Electric shape (`deleted_at IS NULL` in
   * routes/api/tasks.ts) and ceases to exist for every client — no UI filtering to
   * remember at each call site, and the unread badges stay correct for free.
   *
   * The task RELEASES ITS NAME on delete: tasks_channel_name_unique is partial on
   * `deleted_at IS NULL`, so you can recreate a task you just deleted. Without that
   * predicate the name would stay taken by a row nobody can see.
   *
   * Its attachments go with it. Its status-history NOTES do not — those are ordinary
   * channel messages and stay in the channel; they merely stop being reachable from a
   * task page that no longer exists.
   */
  delete: authedProcedure
    .input(deleteTaskInput)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)

        const [task] = await tx
          .select()
          .from(tasksTable)
          .where(eq(tasksTable.id, input.id))

        if (!task) {
          throw new TRPCError({
            code: `NOT_FOUND`,
            message: `Task not found`,
          })
        }

        // Creator only — matching the assignment rule above. The previous hard
        // delete had no check, so anyone could delete anyone's task.
        if (task.createdby_id !== ctx.session.user.id) {
          throw new TRPCError({
            code: `FORBIDDEN`,
            message: `Only the task's creator can delete it`,
          })
        }

        // Already deleted — idempotent, so an outbox retry is harmless.
        if (task.deleted_at) return { item: task, txid }

        const [deletedItem] = await tx
          .update(tasksTable)
          .set({ deleted_at: new Date(), deleted_by_id: ctx.session.user.id })
          .where(eq(tasksTable.id, input.id))
          .returning()

        await tx
          .update(resourcesTable)
          .set({ deleted_at: new Date(), deleted_by_id: ctx.session.user.id })
          .where(eq(resourcesTable.task_id, input.id))

        return { item: deletedItem, txid }
      })

      return result
    }),
})
