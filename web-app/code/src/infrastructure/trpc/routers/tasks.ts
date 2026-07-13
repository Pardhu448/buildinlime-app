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

export const tasksRouter = router({
  create: authedProcedure
    .input(createTaskSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        // ON CONFLICT DO NOTHING makes retries from the offline outbox safe:
        // if a previous attempt succeeded but the response was lost, the
        // second call returns the existing row without raising a duplicate-key error.
        const [inserted] = await tx
          .insert(tasksTable)
          .values(input)
          .onConflictDoNothing()
          .returning()
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

        const [updatedItem] = await tx
          .update(tasksTable)
          .set(input.data)
          .where(eq(tasksTable.id, input.id))
          .returning()

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
