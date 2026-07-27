import { and, eq, isNull, inArray } from "drizzle-orm"
import type { db } from "../database/connection"
import {
  buildUnitsTable,
  channelsTable,
  membershipTable,
  projectsTable,
} from "../database/schema/organization-tables"
import { messagesTable, tasksTable } from "../database/schema/communication-tables"

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
 * TWO THINGS ARE DELIBERATELY NOT COPIED, because the template is a real project
 * with real history:
 *
 * - `mention_ids` are dropped. The template's messages mention actual users;-
 *   carrying those ids into a stranger's project would plant references to real
 *   people in it. The @name remains as ordinary text, which is inert.
 * - `resource_ids` are dropped and resource rows are not cloned. A resource row
 *   belongs to the template's channel, which is outside the new owner's access
 *   scope, so a copied id renders as a broken attachment. Cloning the files
 *   themselves would mean duplicating stored objects per signup.
 */

/** Accepts the pooled db or an open transaction. */
type DbLike = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

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

  for (const message of templateMessages) {
    const newChannelId = channelMap.get(message.channel_id)
    const newUnitId = unitMap.get(message.buildunit_id)
    if (!newChannelId || !newUnitId) continue

    await tx.insert(messagesTable).values({
      id: crypto.randomUUID(),
      text: message.text,
      channel_id: newChannelId,
      buildunit_id: newUnitId,
      project_id: project.id,
      createdby_id: ownerId,
      // See the header: real user ids and cross-project resource ids must not
      // travel into someone else's copy.
      mention_ids: [],
      resource_ids: [],
    })
  }

  // Tasks. task_id links from messages are not carried across for the same
  // reason parent_id is not: the target may not exist in the copy.
  const templateTasks = await tx
    .select()
    .from(tasksTable)
    .where(
      and(inArray(tasksTable.channel_id, templateChannelIds), isNull(tasksTable.deleted_at))
    )

  for (const task of templateTasks) {
    const newChannelId = channelMap.get(task.channel_id)
    const newUnitId = unitMap.get(task.buildunit_id)
    if (!newChannelId || !newUnitId) continue

    await tx.insert(tasksTable).values({
      id: crypto.randomUUID(),
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
  }

  return { status: "created", projectId: project.id }
}
