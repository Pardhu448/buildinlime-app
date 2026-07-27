import { describe, it, expect } from "vitest"
import { eq } from "drizzle-orm"
import { usersRouter } from "%/infrastructure/trpc/routers/users"
import { users } from "%/infrastructure/database/schema/admin-schema"
import { db } from "./setup/db"
import { makeCtx } from "./setup/ctx"
import { createUser } from "./factories"

// Email lookups are case-INSENSITIVE, and the mobile login screen is why this is
// pinned rather than assumed. It refuses to send a sign-in code unless
// checkEmail reports the account exists (mobile-app/app/(auth)/login.tsx), so a
// case-sensitive comparison surfaced to the user as "No account found for this
// email address" for an account that does exist — indistinguishable from a typo.
//
// better-auth lowercases on all of its own paths, so the two sides silently
// disagreed only for addresses a human typed with a capital letter.
// checkEmail and register are public procedures, but makeCtx builds a session
// from a real user, so seed a throwaway one to hang the context off.
const caller = async () => usersRouter.createCaller(makeCtx(await createUser()))

describe("users.checkEmail is case-insensitive", () => {
  it("finds a lowercase-stored account regardless of how it is typed", async () => {
    const user = await createUser({ email: "casetest.person@example.test" })

    for (const typed of [
      "casetest.person@example.test",
      "CaseTest.Person@example.test",
      "CASETEST.PERSON@EXAMPLE.TEST",
    ]) {
      const result = await (await caller()).checkEmail({ email: typed })
      expect(result, `typed as ${typed}`).toEqual({ exists: true })
    }

    expect(user.email).toBe("casetest.person@example.test")
  })

  it("finds a mixed-case STORED account too", async () => {
    // register used to insert the raw address, so such rows can already exist in
    // production. Lowercasing only the input would still miss them, which is why
    // the comparison lowers the column rather than trusting the stored value.
    await createUser({ email: "Legacy.MixedCase@example.test" })

    const result = await (await caller()).checkEmail({ email: "legacy.mixedcase@example.test" })
    expect(result).toEqual({ exists: true })
  })

  it("still reports genuinely absent accounts as absent", async () => {
    const result = await (await caller()).checkEmail({
      email: "definitely-not-registered@example.test",
    })
    expect(result).toEqual({ exists: false })
  })
})

describe("users.register normalises email", () => {
  it("stores the address lowercase", async () => {
    // A mixed-case row is an account better-auth's findUserByEmail can never
    // locate, so registration would appear to succeed and then no sign-in code
    // would ever arrive.
    const { userId } = await (await caller()).register({
      email: "NewPerson.Register@Example.Test",
      name: "New Person",
    })

    const [row] = await db.select().from(users).where(eq(users.id, userId))
    expect(row.email).toBe("newperson.register@example.test")
  })

  it("rejects a duplicate that differs only in case", async () => {
    await (await caller()).register({ email: "dupe.check@example.test", name: "First" })

    await expect(
      (await caller()).register({ email: "Dupe.Check@Example.Test", name: "Second" })
    ).rejects.toThrow(/already exists/)
  })
})
