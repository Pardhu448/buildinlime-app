import { describe, it, expect } from "vitest"
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
