import { describe, it, expect } from "vitest"
import { eq } from "drizzle-orm"
import { tasksTable } from "%/infrastructure/database/schema/admin-schema"
import { db } from "./setup/db"
import { makeCtx, makeAnonCtx } from "./setup/ctx"
import { createUser, seedChannel, addMember, createTask } from "./factories"

// Verifies the Phase 2 harness itself: a real migrated Postgres, working
// factories, per-test truncation, and a usable tRPC Context. Router authz specs
// build on this in Phase 3.
describe("integration harness", () => {
  it("seeds a full hierarchy against real Postgres and reads it back", async () => {
    const owner = await createUser()
    const seeded = await seedChannel(owner)
    const member = await createUser()
    await addMember(seeded, member, "viewer")
    const task = await createTask({
      channelId: seeded.channel.id,
      buildUnitId: seeded.buildUnit.id,
      createdById: owner.id,
    })

    const [found] = await db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.id, task.id))
    expect(found.name).toBe(task.name)
    expect(found.channel_id).toBe(seeded.channel.id)
  })

  it("truncates between tests — the previous test's rows are gone", async () => {
    const rows = await db.select().from(tasksTable)
    expect(rows).toHaveLength(0)
  })

  it("makeCtx wraps a user as an authed context; makeAnonCtx has no session", async () => {
    const user = await createUser()
    const ctx = makeCtx(user)
    expect(ctx.session?.user.id).toBe(user.id)
    expect(ctx.db).toBeDefined()
    expect(makeAnonCtx().session).toBeNull()
  })
})
