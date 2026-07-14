import { router, authedProcedure, generateTxId } from "../lib/trpc"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { eq } from "drizzle-orm"
import {
  tasksTable,
  createTaskSchema,
} from "../../database/schema/admin-schema"

/**
 * Only the fields a task's lifecycle may legitimately change.
 *
 * This used to be `updateTaskSchema` — a full partial — which meant any
 * authenticated user could set ANY column on ANY task, including `createdby_id`,
 * `channel_id` and `buildunit_id`: rewriting authorship or moving a task into
 * another channel entirely. The client only ever sent four fields, so nothing
 * broke, but nothing stopped it either.
 */
const taskPatchSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  completed: z.boolean().optional(),
  assignee_id: z.string().nullish(),
  closed_at: z.coerce.date().optional(),
})

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
    .input(createTaskSchema)
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
    .input(
      z.object({
        id: z.string(),
        data: taskPatchSchema,
      })
    )
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

  delete: authedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        const [deletedItem] = await tx
          .delete(tasksTable)
          .where(eq(tasksTable.id, input.id))
          .returning()

        if (!deletedItem) {
          throw new TRPCError({
            code: `NOT_FOUND`,
            message: `Task not found`,
          })
        }

        return { item: deletedItem, txid }
      })

      return result
    }),
})
