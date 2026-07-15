import type { InferSelectModel } from "drizzle-orm"
import { users } from "%/infrastructure/database/schema/admin-schema"
import type { Context } from "%/infrastructure/trpc/lib/trpc"
import { db } from "./db"

// `import type { Context }` is erased at runtime (verbatimModuleSyntax), so this
// file never imports trpc/lib/trpc's runtime deps (connection.ts, better-auth).

export type AppUser = InferSelectModel<typeof users>

/**
 * Wrap a seeded user as an authenticated tRPC Context — the exact shape
 * `authedProcedure` expects. isAuthed only reads `ctx.session.user.id`, so a
 * structural session object is enough; the cast bridges better-auth's richer
 * session type without importing it. Pass a router's `.createCaller(makeCtx(u))`
 * to drive mutations as that user.
 */
export function makeCtx(user: AppUser): Context {
  const now = new Date()
  const session = {
    session: {
      id: `test-session-${user.id}`,
      token: `test-token-${user.id}`,
      userId: user.id,
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
      ipAddress: null,
      userAgent: null,
    },
    user,
  }
  return { db, session } as unknown as Context
}

/** An unauthenticated context — for asserting the UNAUTHORIZED path. */
export function makeAnonCtx(): Context {
  return { db, session: null } as unknown as Context
}
