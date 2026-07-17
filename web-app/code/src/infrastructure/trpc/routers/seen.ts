import { router, authedProcedure, generateTxId } from "../lib/trpc"
import { sql } from "drizzle-orm"
import { seenStateTable } from "../../database/schema/admin-schema"
import { markSeenInput } from "@buildinlime/contracts"

/**
 * Per-user "last seen" markers (the timestamp successor to reads). `user_id` is
 * always the session user — never taken from the client — so one user can't move
 * another's markers, and the Electric shape (scoped `user_id = me`) stays honest.
 *
 * Unlike reads.markRead (insert-only, keep the FIRST read_at), this UPSERTS and
 * advances seen_at to the LATEST: every visit to a view pushes the "seen up to"
 * line forward. scope_id is '' for the singleton inbox / mytasks scopes and the
 * channel id for a channel.
 */
export const seenRouter = router({
  markSeen: authedProcedure
    .input(markSeenInput)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        const seenAt = input.seen_at ?? new Date()

        // ON CONFLICT DO UPDATE with GREATEST: an out-of-order outbox replay must
        // never move the line BACKWARD. Concurrent tabs / late retries can arrive
        // stale; keep the most-recent seen_at.
        await tx
          .insert(seenStateTable)
          .values({
            user_id: ctx.session.user.id,
            scope: input.scope,
            scope_id: input.scope_id,
            seen_at: seenAt,
          })
          .onConflictDoUpdate({
            target: [seenStateTable.user_id, seenStateTable.scope, seenStateTable.scope_id],
            set: {
              // Bind the Date (not an ISO string) so it's a timestamptz parameter —
              // GREATEST(timestamptz, text) is a type error in Postgres.
              seen_at: sql`GREATEST(${seenStateTable.seen_at}, ${seenAt})`,
            },
          })

        return { txid }
      })

      return result
    }),
})
