import { router, authedProcedure, generateTxId } from "../lib/trpc"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { eq } from "drizzle-orm"
import {
  messagesTable,
  resourcesTable,
  createMessageSchema,
} from "../../database/schema/admin-schema"

export const messagesRouter = router({
  create: authedProcedure
    .input(createMessageSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        // ON CONFLICT DO NOTHING — outbox retries become idempotent.
        const [inserted] = await tx
          .insert(messagesTable)
          .values(input)
          .onConflictDoNothing()
          .returning()
        if (inserted) return { item: inserted, txid }
        const [existing] = await tx
          .select()
          .from(messagesTable)
          .where(eq(messagesTable.id, input.id))
        return { item: existing, txid }
      })

      return result
    }),

  /**
   * SOFT delete, by redacting in place.
   *
   * The row must survive: replies hang off it via parent_id, and removing it would
   * orphan every reply beneath it — a whole conversation would silently vanish
   * because the client builds its thread list from roots and buckets the rest by
   * parent. So the message stays in the Electric shape, and the client renders a
   * "this message was deleted" tombstone from deleted_at.
   *
   * But the CONTENT is genuinely destroyed, not merely hidden: text, mention_ids and
   * resource_ids are cleared here. A soft delete that leaves the words sitting in
   * every device's local database is not a delete. Clearing mention_ids also drops
   * the message out of the Inbox and the unread-mention badge for free.
   *
   * Its attachments go with it — resources.message_id used to CASCADE on a hard
   * delete, so hiding the message must still hide its files or they would outlive
   * the message that carried them.
   */
  delete: authedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)

        const [message] = await tx
          .select()
          .from(messagesTable)
          .where(eq(messagesTable.id, input.id))

        if (!message) {
          throw new TRPCError({ code: `NOT_FOUND`, message: `Message not found` })
        }

        // Author only. Enforced here, not by hiding the button — the previous hard
        // delete had NO check at all, so any authenticated user could delete anyone's
        // message by calling this endpoint.
        if (message.createdby_id !== ctx.session.user.id) {
          throw new TRPCError({
            code: `FORBIDDEN`,
            message: `Only the author can delete this message`,
          })
        }

        // Already deleted — idempotent, so an outbox retry is harmless.
        if (message.deleted_at) return { item: message, txid }

        const [deletedItem] = await tx
          .update(messagesTable)
          .set({
            text: ``,
            mention_ids: [],
            resource_ids: [],
            deleted_at: new Date(),
            deleted_by_id: ctx.session.user.id,
          })
          .where(eq(messagesTable.id, input.id))
          .returning()

        await tx
          .update(resourcesTable)
          .set({ deleted_at: new Date(), deleted_by_id: ctx.session.user.id })
          .where(eq(resourcesTable.message_id, input.id))

        return { item: deletedItem, txid }
      })

      return result
    }),
})
