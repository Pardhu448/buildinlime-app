import { describe, it, expect } from "vitest"
import { eq } from "drizzle-orm"
import { messagesRouter } from "%/infrastructure/trpc/routers/messages"
import {
  messagesTable,
  resourcesTable,
} from "%/infrastructure/database/schema/admin-schema"
import { db } from "./setup/db"
import { makeCtx, type AppUser } from "./setup/ctx"
import {
  createUser,
  seedChannel,
  createMessage,
  createResource,
} from "./factories"

// messages.delete is a REDACT-IN-PLACE soft delete (ARCHITECTURE.md §4 / §3f):
// the row must survive (replies hang off it via parent_id) but the words must be
// destroyed. Counter-intuitive enough to deserve a pinned test.
const caller = (user: AppUser) => messagesRouter.createCaller(makeCtx(user))

describe("messages.delete redaction", () => {
  it("keeps the row but clears text, mentions and resource ids", async () => {
    const author = await createUser()
    const mentioned = await createUser()
    const seeded = await seedChannel(author)
    const message = await createMessage({
      channelId: seeded.channel.id,
      buildUnitId: seeded.buildUnit.id,
      projectId: seeded.project.id,
      createdById: author.id,
      text: "the secret words",
      mention_ids: [mentioned.id],
      resource_ids: ["res-1", "res-2"],
    })

    await caller(author).delete({ id: message.id })

    const [row] = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.id, message.id))

    // Row survives (a deleted parent must not orphan its replies)...
    expect(row).toBeDefined()
    // ...but the content is genuinely destroyed, not merely hidden.
    expect(row.text).toBe("")
    expect(row.mention_ids).toEqual([])
    expect(row.resource_ids).toEqual([])
    expect(row.deleted_at).not.toBeNull()
    expect(row.deleted_by_id).toBe(author.id)
  })

  it("soft-deletes attachments that hung off the message", async () => {
    const author = await createUser()
    const seeded = await seedChannel(author)
    const message = await createMessage({
      channelId: seeded.channel.id,
      buildUnitId: seeded.buildUnit.id,
      projectId: seeded.project.id,
      createdById: author.id,
    })
    const attachment = await createResource({
      channelId: seeded.channel.id,
      buildUnitId: seeded.buildUnit.id,
      projectId: seeded.project.id,
      createdById: author.id,
      message_id: message.id,
    })

    await caller(author).delete({ id: message.id })

    const [row] = await db
      .select()
      .from(resourcesTable)
      .where(eq(resourcesTable.id, attachment.id))
    expect(row.deleted_at).not.toBeNull()
  })

  it("rejects a non-author with FORBIDDEN", async () => {
    const author = await createUser()
    const stranger = await createUser()
    const seeded = await seedChannel(author)
    const message = await createMessage({
      channelId: seeded.channel.id,
      buildUnitId: seeded.buildUnit.id,
      projectId: seeded.project.id,
      createdById: author.id,
      text: "still here",
    })

    await expect(
      caller(stranger).delete({ id: message.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })

    const [row] = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.id, message.id))
    expect(row.text).toBe("still here")
    expect(row.deleted_at).toBeNull()
  })

  it("throws NOT_FOUND for an unknown id", async () => {
    const user = await createUser()
    await expect(caller(user).delete({ id: "nope" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    })
  })
})
