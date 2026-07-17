import { faker } from "@faker-js/faker"
import type { InferInsertModel, InferSelectModel } from "drizzle-orm"
import {
  users,
  projectsTable,
  buildUnitsTable,
  channelsTable,
  membershipTable,
  tasksTable,
  resourcesTable,
  messagesTable,
  CHANNEL_NAMES,
} from "%/infrastructure/database/schema/admin-schema"
import type { MembershipRole } from "%/infrastructure/database/schema/admin-schema"
import { db } from "./setup/db"

// Insert-and-return factories. Each mints a client-style UUID id (mirroring the
// app, §5 of ARCHITECTURE.md) and returns the persisted row so callers can chain
// foreign keys. `overrides` accepts any column on the table.

const uuid = () => faker.string.uuid()

export async function createUser(
  overrides: Partial<InferInsertModel<typeof users>> = {},
): Promise<InferSelectModel<typeof users>> {
  const id = overrides.id ?? uuid()
  const [row] = await db
    .insert(users)
    .values({
      id,
      name: faker.person.fullName(),
      // uuid in the local-part guarantees uniqueness against the unique index.
      email: `${id}@example.test`,
      emailVerified: true,
      ...overrides,
    })
    .returning()
  return row
}

export async function createProject(
  opts: { ownerId: string } & Partial<InferInsertModel<typeof projectsTable>>,
): Promise<InferSelectModel<typeof projectsTable>> {
  const { ownerId, ...rest } = opts
  const [row] = await db
    .insert(projectsTable)
    .values({
      id: uuid(),
      name: faker.commerce.productName(),
      owner_id: ownerId,
      ...rest,
    })
    .returning()
  return row
}

export async function createBuildUnit(
  opts: { projectId: string; ownerId: string } & Partial<
    InferInsertModel<typeof buildUnitsTable>
  >,
): Promise<InferSelectModel<typeof buildUnitsTable>> {
  const { projectId, ownerId, ...rest } = opts
  const [row] = await db
    .insert(buildUnitsTable)
    .values({
      id: uuid(),
      name: faker.commerce.productName(),
      project_id: projectId,
      owner_id: ownerId,
      ...rest,
    })
    .returning()
  return row
}

export async function createChannel(
  opts: { buildUnitId: string; ownerId: string } & Partial<
    InferInsertModel<typeof channelsTable>
  >,
): Promise<InferSelectModel<typeof channelsTable>> {
  const { buildUnitId, ownerId, ...rest } = opts
  const [row] = await db
    .insert(channelsTable)
    .values({
      id: uuid(),
      name: faker.helpers.arrayElement(CHANNEL_NAMES),
      buildunit_id: buildUnitId,
      owner_id: ownerId,
      ...rest,
    })
    .returning()
  return row
}

export async function createMembership(opts: {
  userId: string
  channelId: string
  buildUnitId: string
  projectId: string
  role?: MembershipRole
}): Promise<InferSelectModel<typeof membershipTable>> {
  const [row] = await db
    .insert(membershipTable)
    .values({
      id: uuid(),
      user_id: opts.userId,
      channel_id: opts.channelId,
      buildunit_id: opts.buildUnitId,
      project_id: opts.projectId,
      role: opts.role ?? "viewer",
    })
    .returning()
  return row
}

export async function createTask(
  opts: {
    channelId: string
    buildUnitId: string
    createdById: string
  } & Partial<InferInsertModel<typeof tasksTable>>,
): Promise<InferSelectModel<typeof tasksTable>> {
  const { channelId, buildUnitId, createdById, ...rest } = opts
  const [row] = await db
    .insert(tasksTable)
    .values({
      id: uuid(),
      name: faker.lorem.words(3),
      description: faker.lorem.sentence(),
      channel_id: channelId,
      buildunit_id: buildUnitId,
      createdby_id: createdById,
      ...rest,
    })
    .returning()
  return row
}

export async function createResource(
  opts: {
    channelId: string
    buildUnitId: string
    projectId: string
    createdById: string
  } & Partial<InferInsertModel<typeof resourcesTable>>,
): Promise<InferSelectModel<typeof resourcesTable>> {
  const { channelId, buildUnitId, projectId, createdById, ...rest } = opts
  const [row] = await db
    .insert(resourcesTable)
    .values({
      id: uuid(),
      name: faker.system.commonFileName("pdf"),
      file_location: `uploads/resources/${uuid()}`,
      mime_type: "application/pdf",
      file_size_bytes: faker.number.int({ min: 1_000, max: 5_000_000 }),
      channel_id: channelId,
      buildunit_id: buildUnitId,
      project_id: projectId,
      createdby_id: createdById,
      ...rest,
    })
    .returning()
  return row
}

export async function createMessage(
  opts: {
    channelId: string
    buildUnitId: string
    projectId: string
    createdById: string
  } & Partial<InferInsertModel<typeof messagesTable>>,
): Promise<InferSelectModel<typeof messagesTable>> {
  const { channelId, buildUnitId, projectId, createdById, ...rest } = opts
  const [row] = await db
    .insert(messagesTable)
    .values({
      id: uuid(),
      text: faker.lorem.sentence(),
      channel_id: channelId,
      buildunit_id: buildUnitId,
      project_id: projectId,
      createdby_id: createdById,
      mention_ids: [],
      resource_ids: [],
      ...rest,
    })
    .returning()
  return row
}

// -------------------------------------------------------------------------
// Composite helpers — the common "a channel with a member" arrangement that
// almost every authz test needs.
// -------------------------------------------------------------------------

export interface SeededChannel {
  project: InferSelectModel<typeof projectsTable>
  buildUnit: InferSelectModel<typeof buildUnitsTable>
  channel: InferSelectModel<typeof channelsTable>
}

/** Owner → project → build unit → channel, all owned by `owner`. */
export async function seedChannel(owner: {
  id: string
}): Promise<SeededChannel> {
  const project = await createProject({ ownerId: owner.id })
  const buildUnit = await createBuildUnit({
    projectId: project.id,
    ownerId: owner.id,
  })
  const channel = await createChannel({
    buildUnitId: buildUnit.id,
    ownerId: owner.id,
  })
  return { project, buildUnit, channel }
}

/** Grant `user` membership of an already-seeded channel, denormalised ids and all. */
export async function addMember(
  seeded: SeededChannel,
  user: { id: string },
  role: MembershipRole = "viewer",
): Promise<InferSelectModel<typeof membershipTable>> {
  return createMembership({
    userId: user.id,
    channelId: seeded.channel.id,
    buildUnitId: seeded.buildUnit.id,
    projectId: seeded.project.id,
    role,
  })
}
