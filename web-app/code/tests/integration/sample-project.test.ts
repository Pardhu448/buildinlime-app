import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, it, expect, afterAll } from "vitest"
import { and, eq, inArray } from "drizzle-orm"
import { usersRouter } from "%/infrastructure/trpc/routers/users"
import { provisionSampleProject } from "%/infrastructure/onboarding/sample-project"
import {
  projectsTable,
  buildUnitsTable,
  channelsTable,
  membershipTable,
  messagesTable,
  tasksTable,
  resourcesTable,
  resourcesRawTable,
} from "%/infrastructure/database/schema/admin-schema"
import { db } from "./setup/db"
import { makeCtx } from "./setup/ctx"
import { createUser, seedChannel, createMessage } from "./factories"

// New accounts get their OWN copy of the template project, owned by them.
//
// Ownership is the whole point: it is what gates renaming, deleting and adding
// build units or channels (projects.ts:52/97, buildunits.ts:29, channels.ts:38).
// A member-only copy would show "add a build unit" and throw when pressed. And
// because role is not enforced anywhere, a single SHARED sample would let every
// user read and post over every other user's content.

// getStorage() caches its driver on the FIRST call and reads these env vars only
// then. That call happens inside cloneResources at test time, not at import time,
// so setting them at module scope here is early enough — module bodies run before
// any test does.
const UPLOADS = path.join(os.tmpdir(), `sample-project-test-${process.pid}`)
process.env.STORAGE_DRIVER = "local"
process.env.LOCAL_STORAGE_DIR = UPLOADS

const caller = async () => usersRouter.createCaller(makeCtx(await createUser()))

/** Build a template project named exactly what the provisioner looks for. */
async function seedTemplate() {
  const owner = await createUser()
  const seeded = await seedChannel(owner)
  await db
    .update(projectsTable)
    .set({ name: "Sample Project", description: "the template" })
    .where(eq(projectsTable.id, seeded.project.id))
  return { owner, ...seeded }
}

describe("sample project cloning", () => {
  it("gives the new user a copy they OWN", async () => {
    const template = await seedTemplate()
    const newcomer = await createUser()

    const result = await provisionSampleProject(db, newcomer.id)
    expect(result.status).toBe("created")

    const [copy] = await db
      .select()
      .from(projectsTable)
      .where(
        and(
          eq(projectsTable.owner_id, newcomer.id),
          eq(projectsTable.name, "Sample Project")
        )
      )

    expect(copy).toBeDefined()
    expect(copy.owner_id).toBe(newcomer.id)
    // A distinct row, not the template itself.
    expect(copy.id).not.toBe(template.project.id)
  })

  it("gives the copy membership rows, without which it syncs as an empty shell", async () => {
    await seedTemplate()
    const newcomer = await createUser()
    const result = await provisionSampleProject(db, newcomer.id)
    if (result.status === "skipped") throw new Error("template not found")

    const channels = await db
      .select({ id: channelsTable.id, owner_id: channelsTable.owner_id })
      .from(channelsTable)
      .innerJoin(buildUnitsTable, eq(buildUnitsTable.id, channelsTable.buildunit_id))
      .where(eq(buildUnitsTable.project_id, result.projectId))

    const memberships = await db
      .select({ channel_id: membershipTable.channel_id })
      .from(membershipTable)
      .where(eq(membershipTable.user_id, newcomer.id))

    expect(channels.length).toBeGreaterThan(0)
    // One membership per cloned channel — the pairing channels.create maintains.
    expect(memberships.length).toBe(channels.length)
    for (const c of channels) expect(c.owner_id).toBe(newcomer.id)
  })

  it("does NOT carry mention_ids or resource_ids into the copy", async () => {
    // The real template mentions actual users and references files in its own
    // channels. Copying either would plant references to real people in a
    // stranger's project, and produce attachments they cannot load.
    const template = await seedTemplate()
    const mentioned = await createUser()
    await createMessage({
      channelId: template.channel.id,
      buildUnitId: template.buildUnit.id,
      projectId: template.project.id,
      createdById: template.owner.id,
      text: "@someone take a look at this drawing",
      mention_ids: [mentioned.id],
      resource_ids: ["template-resource-1"],
    })

    const newcomer = await createUser()
    const result = await provisionSampleProject(db, newcomer.id)
    if (result.status === "skipped") throw new Error("template not found")

    const clonedChannels = await db
      .select({ id: channelsTable.id })
      .from(channelsTable)
      .innerJoin(buildUnitsTable, eq(buildUnitsTable.id, channelsTable.buildunit_id))
      .where(eq(buildUnitsTable.project_id, result.projectId))

    const copied = await db
      .select()
      .from(messagesTable)
      .where(
        inArray(
          messagesTable.channel_id,
          clonedChannels.map((c) => c.id)
        )
      )

    expect(copied.length).toBeGreaterThan(0)
    for (const m of copied) {
      expect(m.mention_ids).toEqual([])
      expect(m.resource_ids).toEqual([])
      // Authorship is reassigned; the template's author must not appear.
      expect(m.createdby_id).toBe(newcomer.id)
    }
    // The text itself survives — only the ids are stripped.
    expect(copied.some((m) => m.text.includes("drawing"))).toBe(true)
  })

  it("reassigns task ownership and assignee to the new owner", async () => {
    const template = await seedTemplate()
    await db.insert(tasksTable).values({
      id: crypto.randomUUID(),
      name: "Template task",
      description: "from the template",
      completed: false,
      channel_id: template.channel.id,
      buildunit_id: template.buildUnit.id,
      createdby_id: template.owner.id,
      assignee_id: template.owner.id,
    })

    const newcomer = await createUser()
    const result = await provisionSampleProject(db, newcomer.id)
    if (result.status === "skipped") throw new Error("template not found")

    const clonedChannels = await db
      .select({ id: channelsTable.id })
      .from(channelsTable)
      .innerJoin(buildUnitsTable, eq(buildUnitsTable.id, channelsTable.buildunit_id))
      .where(eq(buildUnitsTable.project_id, result.projectId))

    const [task] = await db
      .select()
      .from(tasksTable)
      .where(
        inArray(
          tasksTable.channel_id,
          clonedChannels.map((c) => c.id)
        )
      )

    expect(task.name).toBe("Template task")
    expect(task.createdby_id).toBe(newcomer.id)
    expect(task.assignee_id).toBe(newcomer.id)
  })

  it("is idempotent — a retried registration cannot produce two copies", async () => {
    await seedTemplate()
    const newcomer = await createUser()

    const first = await provisionSampleProject(db, newcomer.id)
    const second = await provisionSampleProject(db, newcomer.id)

    expect(first.status).toBe("created")
    expect(second.status).toBe("exists")

    const copies = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(
        and(
          eq(projectsTable.owner_id, newcomer.id),
          eq(projectsTable.name, "Sample Project")
        )
      )
    expect(copies.length).toBe(1)
  })

  it("does not clone the template into its own owner", async () => {
    const template = await seedTemplate()
    const result = await provisionSampleProject(db, template.owner.id)

    expect(result).toEqual({ status: "exists", projectId: template.project.id })

    const owned = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(
        and(
          eq(projectsTable.owner_id, template.owner.id),
          eq(projectsTable.name, "Sample Project")
        )
      )
    expect(owned.length).toBe(1)
  })

  it("keeps cloning the ORIGINAL template, not an earlier user's copy", async () => {
    // Copies carry the template's name, so after the first signup there are two
    // "Sample Project" rows and the name lookup is ambiguous. Whichever row wins
    // must be stable, or users would receive drifting samples — and a copy that
    // its owner has since edited would become the source for everyone after them.
    const template = await seedTemplate()
    const first = await createUser()
    const firstResult = await provisionSampleProject(db, first.id)
    if (firstResult.status === "skipped") throw new Error("template not found")

    // The first user edits their copy, as owners are free to do.
    await db
      .update(buildUnitsTable)
      .set({ name: "RENAMED BY FIRST USER" })
      .where(eq(buildUnitsTable.project_id, firstResult.projectId))

    const second = await createUser()
    const secondResult = await provisionSampleProject(db, second.id)
    if (secondResult.status === "skipped") throw new Error("template not found")

    const units = await db
      .select({ name: buildUnitsTable.name })
      .from(buildUnitsTable)
      .where(eq(buildUnitsTable.project_id, secondResult.projectId))

    const templateUnits = await db
      .select({ name: buildUnitsTable.name })
      .from(buildUnitsTable)
      .where(eq(buildUnitsTable.project_id, template.project.id))

    expect(units.map((u) => u.name)).toEqual(templateUnits.map((u) => u.name))
    expect(units.some((u) => u.name === "RENAMED BY FIRST USER")).toBe(false)
  })

  it("skips cleanly when no template exists", async () => {
    const newcomer = await createUser()
    const result = await provisionSampleProject(db, newcomer.id)
    expect(result.status).toBe("skipped")
  })
})

afterAll(async () => {
  await fs.rm(UPLOADS, { recursive: true, force: true })
})

/** A template attachment: resources row, resources_raw row, and real bytes on disk. */
async function seedTemplateResource(
  template: Awaited<ReturnType<typeof seedTemplate>>,
  opts: { messageId?: string; taskId?: string; bytes: string }
) {
  const id = crypto.randomUUID()
  const key = `resources/${id}/photo.jpg`
  const full = path.join(UPLOADS, key)
  await fs.mkdir(path.dirname(full), { recursive: true })
  await fs.writeFile(full, opts.bytes)

  await db.insert(resourcesTable).values({
    id,
    name: "Site photo",
    file_location: `/api/resources/${id}/file`,
    mime_type: "image/jpeg",
    file_size_bytes: opts.bytes.length,
    message_id: opts.messageId ?? null,
    task_id: opts.taskId ?? null,
    channel_id: template.channel.id,
    buildunit_id: template.buildUnit.id,
    project_id: template.project.id,
    createdby_id: template.owner.id,
  })
  await db.insert(resourcesRawTable).values({
    id: crypto.randomUUID(),
    resource_id: id,
    storage_path: key,
    original_filename: "photo.jpg",
    mime_type: "image/jpeg",
    file_size_bytes: opts.bytes.length,
  })
  return { id, key }
}

describe("cloning attachments", () => {
  it("gives the copy its own resource row, its own key, and its own bytes", async () => {
    // The critical property. Storage keys derive from the resource id, so reusing
    // the template's storage_path would point two rows at ONE object — and the
    // purge job would reclaim it on behalf of whichever copy was deleted first,
    // breaking the image for the template and every other user at once.
    const template = await seedTemplate()
    const message = await createMessage({
      channelId: template.channel.id,
      buildUnitId: template.buildUnit.id,
      projectId: template.project.id,
      createdById: template.owner.id,
      text: "here is the site photo",
    })
    const original = await seedTemplateResource(template, {
      messageId: message.id,
      bytes: "PHOTO-BYTES",
    })

    const newcomer = await createUser()
    const result = await provisionSampleProject(db, newcomer.id)
    if (result.status === "skipped") throw new Error("template not found")

    const [copy] = await db
      .select({ resource: resourcesTable, storage_path: resourcesRawTable.storage_path })
      .from(resourcesTable)
      .innerJoin(resourcesRawTable, eq(resourcesRawTable.resource_id, resourcesTable.id))
      .where(eq(resourcesTable.project_id, result.projectId))

    expect(copy).toBeDefined()
    expect(copy.resource.id).not.toBe(original.id)
    expect(copy.storage_path).not.toBe(original.key)
    // The URL is derived from the new id, not carried over.
    expect(copy.resource.file_location).toBe(`/api/resources/${copy.resource.id}/file`)
    expect(copy.resource.createdby_id).toBe(newcomer.id)

    // Both objects exist independently, with identical content.
    const originalBytes = await fs.readFile(path.join(UPLOADS, original.key), "utf8")
    const copyBytes = await fs.readFile(path.join(UPLOADS, copy.storage_path), "utf8")
    expect(originalBytes).toBe("PHOTO-BYTES")
    expect(copyBytes).toBe("PHOTO-BYTES")

    // Deleting the copy's object must leave the template's intact — the thing a
    // shared storage_path would have broken.
    await fs.rm(path.join(UPLOADS, copy.storage_path))
    await expect(
      fs.readFile(path.join(UPLOADS, original.key), "utf8")
    ).resolves.toBe("PHOTO-BYTES")
  })

  it("reattaches the copy to the cloned message, both ways", async () => {
    const template = await seedTemplate()
    const message = await createMessage({
      channelId: template.channel.id,
      buildUnitId: template.buildUnit.id,
      projectId: template.project.id,
      createdById: template.owner.id,
      text: "attachment carrier",
    })
    await seedTemplateResource(template, { messageId: message.id, bytes: "A" })

    const newcomer = await createUser()
    const result = await provisionSampleProject(db, newcomer.id)
    if (result.status === "skipped") throw new Error("template not found")

    const [copy] = await db
      .select()
      .from(resourcesTable)
      .where(eq(resourcesTable.project_id, result.projectId))

    const [carrier] = await db
      .select()
      .from(messagesTable)
      .where(
        and(
          eq(messagesTable.project_id, result.projectId),
          eq(messagesTable.text, "attachment carrier")
        )
      )

    // resources.message_id points at the CLONED message, not the template's...
    expect(copy.message_id).toBe(carrier.id)
    expect(copy.message_id).not.toBe(message.id)
    // ...and the denormalised array agrees with it.
    expect(carrier.resource_ids).toEqual([copy.id])
  })

  it("skips an attachment whose parent message was not cloned", async () => {
    // Deleted messages are filtered out of the copy. A resource still pointing at
    // one would land with a dangling message_id.
    const template = await seedTemplate()
    const message = await createMessage({
      channelId: template.channel.id,
      buildUnitId: template.buildUnit.id,
      projectId: template.project.id,
      createdById: template.owner.id,
      text: "doomed",
    })
    await db
      .update(messagesTable)
      .set({ deleted_at: new Date() })
      .where(eq(messagesTable.id, message.id))
    await seedTemplateResource(template, { messageId: message.id, bytes: "B" })

    const newcomer = await createUser()
    const result = await provisionSampleProject(db, newcomer.id)
    if (result.status === "skipped") throw new Error("template not found")

    const copied = await db
      .select()
      .from(resourcesTable)
      .where(eq(resourcesTable.project_id, result.projectId))
    expect(copied).toHaveLength(0)
  })

  it("does not clone a soft-deleted attachment", async () => {
    const template = await seedTemplate()
    const res = await seedTemplateResource(template, { bytes: "C" })
    await db
      .update(resourcesTable)
      .set({ deleted_at: new Date() })
      .where(eq(resourcesTable.id, res.id))

    const newcomer = await createUser()
    const result = await provisionSampleProject(db, newcomer.id)
    if (result.status === "skipped") throw new Error("template not found")

    const copied = await db
      .select()
      .from(resourcesTable)
      .where(eq(resourcesTable.project_id, result.projectId))
    expect(copied).toHaveLength(0)
  })
})

describe("registration wires the sample in", () => {
  it("provisions a sample project for a newly registered user", async () => {
    await seedTemplate()

    const { userId } = await (await caller()).register({
      email: "sample.newcomer@example.test",
      name: "Sample Newcomer",
    })

    const [copy] = await db
      .select()
      .from(projectsTable)
      .where(
        and(eq(projectsTable.owner_id, userId), eq(projectsTable.name, "Sample Project"))
      )

    expect(copy).toBeDefined()
  })

  it("still registers the account when there is no template to clone", async () => {
    // Sample data is a nicety; the account is the thing the user asked for.
    // Failing registration after the user row is committed would leave an
    // account the caller believes does not exist, and the retry would then be
    // rejected with CONFLICT.
    const { userId } = await (await caller()).register({
      email: "no.template@example.test",
      name: "No Template",
    })
    expect(userId).toBeTruthy()
  })
})
