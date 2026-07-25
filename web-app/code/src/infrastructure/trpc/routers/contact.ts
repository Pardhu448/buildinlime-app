import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, procedure } from "../lib/trpc"
import { sendContactEmail } from "../../lib/utils/sendContactEmail"

// Public: the contact form lives on the unauthenticated landing page. Web-only,
// so it is deliberately NOT mirrored in @buildinlime/contracts (mobile never
// calls it); the parity test only asserts contract ⊆ server.
export const contactRouter = router({
  send: procedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(200),
        email: z.string().trim().email().max(320),
        message: z.string().trim().min(1).max(5000),
      })
    )
    .mutation(async ({ input }) => {
      const { success, error } = await sendContactEmail(input)
      if (!success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error || "Failed to send your message. Please try again.",
        })
      }
      return { success: true }
    }),
})
