import { router, authedProcedure, procedure } from "../lib/trpc"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { eq } from "drizzle-orm"
import { users } from "../../database/schema/auth-schema"

export const usersRouter = router({
  checkEmail: procedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ ctx, input }) => {
      const [user] = await ctx.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, input.email))
      return { exists: !!user }
    }),

  register: procedure
    .input(z.object({ email: z.string().email(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, input.email))
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists." })
      }
      const now = new Date()
      const [created] = await ctx.db
        .insert(users)
        .values({
          id: crypto.randomUUID(),
          name: input.name,
          email: input.email,
          emailVerified: false,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: users.id })
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
