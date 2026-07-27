import { checkEmailInput } from "@buildinlime/contracts"
import { router, authedProcedure, procedure } from "../lib/trpc"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { eq, sql } from "drizzle-orm"
import { users } from "../../database/schema/auth-schema"
import { provisionSampleProject } from "../../onboarding/sample-project"

/**
 * Email lookups must be case-insensitive.
 *
 * better-auth lowercases the address on every one of its own paths (its send-OTP
 * route calls `ctx.body.email.toLowerCase()` before doing anything), so accounts
 * created through sign-in are stored lowercase. These procedures were comparing
 * with a plain `eq`, which meant "GooglePlayReview@gmail.com" did not match the
 * stored "googleplayreview@gmail.com".
 *
 * That is not cosmetic. The mobile login screen refuses to send a code at all
 * unless checkEmail says the account exists (app/(auth)/login.tsx) — so a user
 * whose keyboard capitalised the first letter got "No account found for this
 * email address" for an account that plainly does exist, with no way to tell the
 * difference from a genuine typo. Found when a Play reviewer would have hit it.
 *
 * `lower()` on the column rather than trusting stored values to be lowercase:
 * `register` below inserts whatever it is given, so mixed-case rows can exist and
 * lowercasing only the input would still miss them. This does not use the unique
 * index on email; at current user counts that is irrelevant, and correctness here
 * outweighs a scan. Add a `lower(email)` functional index if the table ever grows.
 */
function emailMatches(email: string) {
  return eq(sql`lower(${users.email})`, email.trim().toLowerCase())
}

export const usersRouter = router({
  checkEmail: procedure
    .input(checkEmailInput)
    .query(async ({ ctx, input }) => {
      const [user] = await ctx.db
        .select({ id: users.id })
        .from(users)
        .where(emailMatches(input.email))
      return { exists: !!user }
    }),

  register: procedure
    .input(z.object({ email: z.string().email(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ id: users.id })
        .from(users)
        .where(emailMatches(input.email))
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists." })
      }
      const now = new Date()
      const [created] = await ctx.db
        .insert(users)
        .values({
          id: crypto.randomUUID(),
          name: input.name,
          // Stored lowercase to match better-auth, which lowercases before every
          // lookup it makes. A mixed-case row here would be an account that
          // better-auth's findUserByEmail can never locate — registration would
          // appear to succeed and then no sign-in code would ever arrive, because
          // the send-OTP route treats an unknown address as a silent no-op.
          // The unique index on email is exact, so nothing else catches this.
          email: input.email.trim().toLowerCase(),
          emailVerified: false,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: users.id })

      // Sample project — BEST EFFORT, and deliberately outside the account
      // creation above. The account is the thing the user asked for; example
      // data is a nicety. If cloning fails (template renamed, deleted, or a
      // schema change it did not anticipate) the right outcome is a working
      // account with an empty workspace, not a registration that throws after
      // the user row is already committed — which would leave an account the
      // caller believes does not exist, and `register` would then reject the
      // retry with CONFLICT.
      try {
        await ctx.db.transaction((tx) => provisionSampleProject(tx, created.id))
      } catch (error) {
        console.error("[register] sample project provisioning failed", {
          userId: created.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }

      return { userId: created.id }
    }),

  create: authedProcedure.input(z.any()).mutation(async () => {
    throw new TRPCError({
      code: `FORBIDDEN`,
      message: `Can't create new users through API`,
    })
  }),

  update: authedProcedure
    .input(z.object({ id: z.string(), data: z.any() }))
    .mutation(async () => {
      throw new TRPCError({
        code: `FORBIDDEN`,
        message: `Can't edit users through API`,
      })
    }),

  delete: authedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async () => {
      throw new TRPCError({
        code: `FORBIDDEN`,
        message: `Can't delete users through API`,
      })
    }),
})
