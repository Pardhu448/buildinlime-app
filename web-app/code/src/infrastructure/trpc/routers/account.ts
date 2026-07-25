import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, authedProcedure } from "../lib/trpc"
import { sendDeletionRequestEmail } from "../../lib/utils/sendDeletionRequestEmail"

// Web-only, so deliberately not mirrored in @buildinlime/contracts (the parity
// test only asserts contract ⊆ server). The email/id come from the server
// session, never from client input, so a request cannot be filed for someone
// else. There is no automated purge yet (ARCHITECTURE.md §12.11) — this routes
// the request to support@buildinlime.com for manual action.
export const accountRouter = router({
  requestDeletion: authedProcedure
    .input(
      z.object({
        mode: z.enum(["account-only", "account-and-collective"]),
        reason: z.string().trim().max(5000).default(""),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user
      const { success, error } = await sendDeletionRequestEmail({
        userId: user.id,
        email: user.email,
        name: user.name,
        mode: input.mode,
        reason: input.reason,
      })
      if (!success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error || "Failed to submit your deletion request. Please try again.",
        })
      }
      return { success: true }
    }),
})
