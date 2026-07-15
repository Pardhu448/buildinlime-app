import { describe, it, expect } from "vitest"
import { eq } from "drizzle-orm"
import { resourcesRouter } from "%/infrastructure/trpc/routers/resources"
import { resourcesTable } from "%/infrastructure/database/schema/admin-schema"
import { db } from "./setup/db"
import { makeCtx } from "./setup/ctx"
import type { AppUser } from "./setup/ctx"
import { createUser, seedChannel, createTask, createResource } from "./factories"

// Authorization rules for resources.delete (ARCHITECTURE.md §3a / router comment).
// The comment records that the PREVIOUS version had no check at all — any
// authenticated user could destroy anyone's file. These tests pin the rules so
// that can never silently return.
const caller = (user: AppUser) => resourcesRouter.createCaller(makeCtx(user))

async function fetchResource(id: string) {
  const [row] = await db
    .select()
    .from(resourcesTable)
    .where(eq(resourcesTable.id, id))
  return row
}

describe("resources.delete authorization", () => {
  it("lets the uploader soft-delete their own file", async () => {
    const uploader = await createUser()
    const seeded = await seedChannel(uploader)
    const resource = await createResource({
      channelId: seeded.channel.id,
      buildUnitId: seeded.buildUnit.id,
      projectId: seeded.project.id,
      createdById: uploader.id,
    })

    await caller(uploader).delete({ id: resource.id })

    const row = await fetchResource(resource.id)
    // Soft delete: row SURVIVES, stamped, bytes/path untouched.
    expect(row).toBeDefined()
    expect(row.deleted_at).not.toBeNull()
    expect(row.deleted_by_id).toBe(uploader.id)
    expect(row.file_location).toBe(resource.file_location)
  })

  it("lets the task's creator delete an attachment someone else uploaded", async () => {
    const uploader = await createUser()
    const taskCreator = await createUser()
    const seeded = await seedChannel(uploader)
    const task = await createTask({
      channelId: seeded.channel.id,
      buildUnitId: seeded.buildUnit.id,
      createdById: taskCreator.id,
    })
    const resource = await createResource({
      channelId: seeded.channel.id,
      buildUnitId: seeded.buildUnit.id,
      projectId: seeded.project.id,
      createdById: uploader.id,
      task_id: task.id,
    })

    // taskCreator is NOT the uploader, but owns the task the file hangs off.
    await caller(taskCreator).delete({ id: resource.id })

    const row = await fetchResource(resource.id)
    expect(row.deleted_at).not.toBeNull()
    expect(row.deleted_by_id).toBe(taskCreator.id)
  })

  it("rejects an unrelated user with FORBIDDEN and leaves the file intact", async () => {
    const uploader = await createUser()
    const stranger = await createUser()
    const seeded = await seedChannel(uploader)
    const resource = await createResource({
      channelId: seeded.channel.id,
      buildUnitId: seeded.buildUnit.id,
      projectId: seeded.project.id,
      createdById: uploader.id,
    })

    await expect(caller(stranger).delete({ id: resource.id })).rejects.toMatchObject(
      { code: "FORBIDDEN" },
    )
    const row = await fetchResource(resource.id)
    expect(row.deleted_at).toBeNull()
  })

  it("throws NOT_FOUND for an unknown id", async () => {
    const user = await createUser()
    await expect(
      caller(user).delete({ id: "does-not-exist" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("is idempotent — a second delete does not change deleted_at", async () => {
    const uploader = await createUser()
    const seeded = await seedChannel(uploader)
    const resource = await createResource({
      channelId: seeded.channel.id,
      buildUnitId: seeded.buildUnit.id,
      projectId: seeded.project.id,
      createdById: uploader.id,
    })

    await caller(uploader).delete({ id: resource.id })
    const first = await fetchResource(resource.id)

    await caller(uploader).delete({ id: resource.id })
    const second = await fetchResource(resource.id)

    expect(second.deleted_at?.getTime()).toBe(first.deleted_at?.getTime())
  })
})
