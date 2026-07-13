import { router, authedProcedure, generateTxId } from "../lib/trpc"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { eq } from "drizzle-orm"
import {
  propertiesTable,
  tasksTable,
  createPropertySchema,
  updatePropertySchema,
} from "../../database/schema/admin-schema"

/**
 * The taskStatus property is the source of truth for task completion, so it
 * writes `tasks.completed` through in the SAME transaction as the property row.
 * Keeping the two in one transaction is the point: a second round-trip could
 * leave a task whose pill says Completed but whose column says otherwise, and
 * `completed` is what My Tasks counts and the mobile badge read.
 *
 * `closed_at` is stamped on completion so "when was this finished" is answerable.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncTaskCompletion(tx: any, property: {
  type: string
  entity: string
  entity_id: string
  task_status_value?: string | null
}) {
  if (property.type !== `taskStatus` || property.entity !== `task`) return
  const completed = property.task_status_value === `completed`
  await tx
    .update(tasksTable)
    .set(completed ? { completed: true, closed_at: new Date() } : { completed: false })
    .where(eq(tasksTable.id, property.entity_id))
}

export const propertiesRouter = router({
  create: authedProcedure
    .input(createPropertySchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        // ON CONFLICT DO NOTHING — outbox retries become idempotent.
        // createdby_id is stamped server-side (never trusted from the client)
        // so the properties shape's `OR createdby_id = me` owner escape hatch is
        // reliable.
        const [inserted] = await tx
          .insert(propertiesTable)
          .values({ ...input, createdby_id: ctx.session.user.id })
          .onConflictDoNothing()
          .returning()
        if (inserted) {
          await syncTaskCompletion(tx, inserted)
          return { item: inserted, txid }
        }
        const [existing] = await tx
          .select()
          .from(propertiesTable)
          .where(eq(propertiesTable.id, input.id))
        return { item: existing, txid }
      })

      return result
    }),

  update: authedProcedure
    .input(
      z.object({
        id: z.string(),
        data: updatePropertySchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        const [updatedItem] = await tx
          .update(propertiesTable)
          .set(input.data)
          .where(eq(propertiesTable.id, input.id))
          .returning()

        if (!updatedItem) {
          throw new TRPCError({
            code: `NOT_FOUND`,
            message: `Property not found`,
          })
        }

        await syncTaskCompletion(tx, updatedItem)

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
          .delete(propertiesTable)
          .where(eq(propertiesTable.id, input.id))
          .returning()

        if (!deletedItem) {
          throw new TRPCError({
            code: `NOT_FOUND`,
            message: `Property not found`,
          })
        }

        return { item: deletedItem, txid }
      })

      return result
    }),
})
