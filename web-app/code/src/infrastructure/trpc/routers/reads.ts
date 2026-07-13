import { router, authedProcedure, generateTxId } from "../lib/trpc"
import { z } from "zod"
import { readsTable, READ_ITEM_TYPES } from "../../database/schema/admin-schema"

/**
 * Per-user read state. `user_id` is always the session user — never taken from
 * the client — so one user can't mark items read on another's behalf, and the
 * Electric shape (scoped `user_id = me`) stays truthful.
 *
 * Accepts MANY ids in one call because opening a channel marks every message in
 * it read at once; a per-message round trip would be dozens of requests.
 */
export const readsRouter = router({
  markRead: authedProcedure
    .input(
      z.object({
        item_type: z.enum(READ_ITEM_TYPES),
        item_ids: z.array(z.string()).min(1),
        channel_id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)

        // ON CONFLICT DO NOTHING: re-opening a channel re-marks messages that
        // are already read, and offline-outbox retries replay the same call.
        // Both must be no-ops, and the FIRST read_at is the honest one.
        await tx
          .insert(readsTable)
          .values(
            input.item_ids.map((item_id) => ({
              user_id: ctx.session.user.id,
              item_type: input.item_type,
              item_id,
              channel_id: input.channel_id,
            }))
          )
          .onConflictDoNothing()

        return { txid }
      })

      return result
    }),
})
