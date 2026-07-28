import { and, eq, isNull, inArray } from "drizzle-orm"
import type { db } from "../database/connection"
import {
  buildUnitsTable,
  channelsTable,
  membershipTable,
  projectsTable,
} from "../database/schema/organization-tables"
import {
  messagesTable,
  resourcesRawTable,
  resourcesTable,
  tasksTable,
} from "../database/schema/communication-tables"
import { getStorage } from "../storage/index"

/**
 * The example project every new account starts with, CLONED FROM A REAL PROJECT.
 *
 * Cloning a live project rather than hardcoding fixture data has one large
 * payoff: the sample is curated in the app itself. Edit the template project —
 * rename a build unit, rewrite a message, add a channel — and every subsequent
 * signup gets the improved version, with no deploy.
 *
 * Each user gets their OWN copy, owned by them. Role is not enforced anywhere
 * (resolveMemberScope keys on member_flag alone; messages and tasks do no
 * membership check), so a single shared sample would be a communal space where
 * every user could read and post over every other user's content. Ownership is
 * also what makes it explorable: renaming, deleting, and adding build units or
 * channels are all owner-gated (projects.ts:52/97, buildunits.ts:29,
 * channels.ts:38), so a member-only copy would show "add a build unit" and then
 * throw when the newcomer pressed it.
 *
 * The template is a real project with real history, so some of it must not travel:
 *
 * - `mention_ids` are dropped. The template's messages mention actual users;
 *   carrying those ids into a stranger's project would plant references to real
 *   people in it. The @name remains as ordinary text, which is inert.
 * - Deleted rows are skipped. Tombstoned messages and soft-deleted tasks and
 *   resources are history, not sample content.
 * - `parent_id` and `task_id` links between messages are dropped rather than
 *   remapped: the target may itself have been filtered out, and a dangling
 *   reference orphans a thread.
 *
 * Attachments ARE cloned, each user getting their own resource row, their own
 * storage object and their own `resources_raw` row — see cloneResources below for
 * why a shared object would be actively dangerous rather than merely untidy.
 */

/** Accepts the pooled db or an open transaction. */
type DbLike = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Clone the template's attachments so the copy's images actually load.
 *
 * Each cloned resource gets a NEW id, and both the storage key and the served
 * URL are derived from that id (fileStorage.ts:58-59) — so a fresh id yields a
 * fresh key for free, provided the key is rebuilt rather than copied from
 * `resources_raw.storage_path`. Reusing the template's path would point two rows
 * at one object, and the purge job would then reclaim it on behalf of whichever
 * copy was soft-deleted first, breaking the image for the template and every
 * other user at once.
 *
 * Objects are copied BEFORE the surrounding transaction commits, matching what
 * handleFileUpload already does. The failure modes are asymmetric: a rollback
 * after copying leaves orphaned objects, which the orphan sweep reclaims on its
 * age floor, whereas committing rows first and failing the copy leaves permanent
 * references to files that do not exist.
 */
async function cloneResources(
  tx: DbLike,
  args: {
    templateChannelIds: string[]
    projectId: string
    ownerId: string
    channelMap: Map<string, string>
    unitMap: Map<string, string>
    messageMap: Map<string, string>
    taskMap: Map<string, string>
  }
): Promise<void> {
  const templateResources = await tx
    .select({
      resource: resourcesTable,
      storage_path: resourcesRawTable.storage_path,
      original_filename: resourcesRawTable.original_filename,
    })
    .from(resourcesTable)
    .innerJoin(resourcesRawTable, eq(resourcesRawTable.resource_id, resourcesTable.id))
    .where(
      and(
        inArray(resourcesTable.channel_id, args.templateChannelIds),
        isNull(resourcesTable.deleted_at)
      )
    )

  if (templateResources.length === 0) return

  const storage = getStorage()
  // Accumulated so resource ids can be written back onto the messages that carry
  // them; messages are inserted before resources exist.
  const resourceIdsByMessage = new Map<string, string[]>()

  for (const { resource, storage_path, original_filename } of templateResources) {
    const newChannelId = args.channelMap.get(resource.channel_id)
    const newUnitId = args.unitMap.get(resource.buildunit_id)
    if (!newChannelId || !newUnitId) continue

    // A resource whose parent message or task was filtered out of the clone
    // (deleted, or in a channel that did not come across) would land with a
    // dangling reference. Skip it rather than orphan it.
    const newMessageId = resource.message_id
      ? args.messageMap.get(resource.message_id)
      : null
    if (resource.message_id && !newMessageId) continue

    const newTaskId = resource.task_id ? args.taskMap.get(resource.task_id) : null
    if (resource.task_id && !newTaskId) continue

    const newId = crypto.randomUUID()
    // Rebuilt from the new id, never copied — see this function's header.
    const filename = storage_path.split("/").pop() ?? original_filename
    const newKey = `resources/${newId}/${filename}`

    await storage.copy(storage_path, newKey)

    await tx.insert(resourcesTable).values({
      id: newId,
      name: resource.name,
      description: resource.description,
      // Derived from the id the same way handleFileUpload derives it.
      file_location: `/api/resources/${newId}/file`,
      mime_type: resource.mime_type,
      file_size_bytes: resource.file_size_bytes,
      message_id: newMessageId,
      task_id: newTaskId,
      channel_id: newChannelId,
      buildunit_id: newUnitId,
      project_id: args.projectId,
      createdby_id: args.ownerId,
    })

    await tx.insert(resourcesRawTable).values({
      id: crypto.randomUUID(),
      resource_id: newId,
      storage_path: newKey,
      original_filename,
      mime_type: resource.mime_type,
      file_size_bytes: resource.file_size_bytes,
    })

    if (newMessageId) {
      const ids = resourceIdsByMessage.get(newMessageId) ?? []
      ids.push(newId)
      resourceIdsByMessage.set(newMessageId, ids)
    }
  }

  // messages.resource_ids is empty on the current template — attachments hang off
  // resources.message_id instead — but the column is part of the schema and is
  // populated elsewhere, so keep the two representations consistent in the copy.
  for (const [messageId, ids] of resourceIdsByMessage) {
    await tx
      .update(messagesTable)
      .set({ resource_ids: ids })
      .where(eq(messagesTable.id, messageId))
  }
}

/**
 * Which project to clone. An explicit id wins; otherwise the newest non-deleted
 * project with this name. The name fallback is what makes local and CI databases
 * work without configuration — they simply have no such project, and
 * provisioning is skipped.
 */
export const SAMPLE_TEMPLATE_NAME = process.env.SAMPLE_TEMPLATE_NAME ?? "Sample Project"
const SAMPLE_TEMPLATE_PROJECT_ID = process.env.SAMPLE_TEMPLATE_PROJECT_ID

export type ProvisionResult =
  | { status: "created"; projectId: string }
  | { status: "exists"; projectId: string }
  | { status: "skipped"; reason: string }

async function findTemplateProject(tx: DbLike) {
  if (SAMPLE_TEMPLATE_PROJECT_ID) {
    return (
      await tx
        .select()
        .from(projectsTable)
        .where(
          and(
            eq(projectsTable.id, SAMPLE_TEMPLATE_PROJECT_ID),
            isNull(projectsTable.deleted_at)
          )
        )
    ).at(0)
  }
  // Ordered explicitly: without it the choice between two same-named projects
  // would be whatever Postgres returned first, so which template a user got
  // could change between signups. Oldest wins — the template predates any copy
  // of it, and copies carry the same name.
  return (
    await tx
      .select()
      .from(projectsTable)
      .where(
        and(
          eq(projectsTable.name, SAMPLE_TEMPLATE_NAME),
          isNull(projectsTable.deleted_at)
        )
      )
      .orderBy(projectsTable.created_at)
  ).at(0)
}

/**
 * Give `ownerId` their own copy of the template project.
 *
 * Idempotent on (owner, template name) among non-deleted projects, so a retried
 * registration cannot leave someone with two. Keyed on the name rather than a
 * marker column so that a user who deletes their sample and somehow re-registers
 * gets a fresh one rather than nothing.
 *
 * Pass a transaction to keep the clone atomic — a project with channels but no
 * memberships would sync as an empty shell.
 */
export async function provisionSampleProject(
  tx: DbLike,
  ownerId: string
): Promise<ProvisionResult> {
  const template = await findTemplateProject(tx)
  if (!template) {
    return { status: "skipped", reason: `no template project (${SAMPLE_TEMPLATE_NAME})` }
  }

  // Cloning the template INTO its own owner would duplicate it for them on every
  // call, and the idempotency check below cannot tell the copy from the original.
  if (template.owner_id === ownerId) {
    return { status: "exists", projectId: template.id }
  }

  const existing = (
    await tx
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(
        and(
          eq(projectsTable.owner_id, ownerId),
          eq(projectsTable.name, template.name),
          isNull(projectsTable.deleted_at)
        )
      )
  ).at(0)

  if (existing) return { status: "exists", projectId: existing.id }

  const project = (
    await tx
      .insert(projectsTable)
      .values({
        id: crypto.randomUUID(),
        name: template.name,
        description: template.description,
        owner_id: ownerId,
        priority: template.priority,
        target_date: template.target_date,
        status_percent: template.status_percent,
      })
      .returning({ id: projectsTable.id })
  ).at(0)

  if (!project) throw new Error("sample project insert returned no row")

  const templateUnits = await tx
    .select()
    .from(buildUnitsTable)
    .where(
      and(
        eq(buildUnitsTable.project_id, template.id),
        isNull(buildUnitsTable.deleted_at)
      )
    )

  // Old channel id -> new channel id, so messages and tasks can be remapped.
  const channelMap = new Map<string, string>()
  const unitMap = new Map<string, string>()

  for (const unit of templateUnits) {
    const newUnit = (
      await tx
        .insert(buildUnitsTable)
        .values({
          id: crypto.randomUUID(),
          name: unit.name,
          description: unit.description,
          health: unit.health,
          priority: unit.priority,
          task_name: unit.task_name,
          task_assignee: unit.task_assignee,
          task_since: unit.task_since,
          target_date: unit.target_date,
          status_percent: unit.status_percent,
          project_id: project.id,
          owner_id: ownerId,
        })
        .returning({ id: buildUnitsTable.id })
    ).at(0)

    if (!newUnit) throw new Error(`build unit insert returned no row: ${unit.name}`)
    unitMap.set(unit.id, newUnit.id)

    const templateChannels = await tx
      .select()
      .from(channelsTable)
      .where(
        and(
          eq(channelsTable.buildunit_id, unit.id),
          isNull(channelsTable.deleted_at)
        )
      )

    for (const channel of templateChannels) {
      const newChannel = (
        await tx
          .insert(channelsTable)
          .values({
            id: crypto.randomUUID(),
            name: channel.name,
            description: channel.description,
            buildunit_id: newUnit.id,
            owner_id: ownerId,
          })
          .returning({ id: channelsTable.id })
      ).at(0)

      if (!newChannel) throw new Error(`channel insert returned no row: ${channel.name}`)
      channelMap.set(channel.id, newChannel.id)

      // The membership row is what makes the channel visible through Electric —
      // resolveMemberScope reads memberships, and channel ownership is only a
      // defensive fallback there. channels.create pairs the two the same way.
      await tx.insert(membershipTable).values({
        id: crypto.randomUUID(),
        user_id: ownerId,
        channel_id: newChannel.id,
        buildunit_id: newUnit.id,
        project_id: project.id,
        member_flag: true,
        role: "owner",
      })
    }
  }

  const templateChannelIds = [...channelMap.keys()]
  if (templateChannelIds.length === 0) {
    return { status: "created", projectId: project.id }
  }

  // Messages. Replies are flattened: parent_id is dropped rather than remapped,
  // because a thread parent may itself be filtered out here and a dangling
  // parent_id would orphan the reply. Deleted messages are skipped — they are
  // tombstones, and cloning "This message was deleted" into a fresh sample is
  // noise, not history.
  const templateMessages = await tx
    .select()
    .from(messagesTable)
    .where(
      and(
        inArray(messagesTable.channel_id, templateChannelIds),
        isNull(messagesTable.deleted_at)
      )
    )

  const messageMap = new Map<string, string>()

  for (const message of templateMessages) {
    const newChannelId = channelMap.get(message.channel_id)
    const newUnitId = unitMap.get(message.buildunit_id)
    if (!newChannelId || !newUnitId) continue

    const newId = crypto.randomUUID()
    await tx.insert(messagesTable).values({
      id: newId,
      text: message.text,
      channel_id: newChannelId,
      buildunit_id: newUnitId,
      project_id: project.id,
      createdby_id: ownerId,
      // See the header: real user ids must not travel into someone else's copy.
      mention_ids: [],
      // Filled in below, once the cloned resources have ids to point at.
      resource_ids: [],
    })
    messageMap.set(message.id, newId)
  }

  // Tasks. task_id links from messages are not carried across for the same
  // reason parent_id is not: the target may not exist in the copy.
  const templateTasks = await tx
    .select()
    .from(tasksTable)
    .where(
      and(inArray(tasksTable.channel_id, templateChannelIds), isNull(tasksTable.deleted_at))
    )

  const taskMap = new Map<string, string>()

  for (const task of templateTasks) {
    const newChannelId = channelMap.get(task.channel_id)
    const newUnitId = unitMap.get(task.buildunit_id)
    if (!newChannelId || !newUnitId) continue

    const newId = crypto.randomUUID()
    await tx.insert(tasksTable).values({
      id: newId,
      name: task.name,
      description: task.description,
      completed: task.completed,
      channel_id: newChannelId,
      buildunit_id: newUnitId,
      createdby_id: ownerId,
      // Assigning the template's assignee would point at a real user the new
      // owner has no relationship with.
      assignee_id: ownerId,
    })
    taskMap.set(task.id, newId)
  }

  await cloneResources(tx, {
    templateChannelIds,
    projectId: project.id,
    ownerId,
    channelMap,
    unitMap,
    messageMap,
    taskMap,
  })

  return { status: "created", projectId: project.id }
}
