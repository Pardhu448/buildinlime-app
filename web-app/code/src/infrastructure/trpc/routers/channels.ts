import { router, authedProcedure, generateTxId } from "../lib/trpc"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { eq, and, sql, isNull } from "drizzle-orm"
import {
  channelsTable,
  buildUnitsTable,
  projectsTable,
  membershipTable,
  tasksTable,
  resourcesTable,
} from "../../database/schema/admin-schema"
import {
  createChannelInput,
  updateChannelInput,
  deleteChannelInput,
} from "@buildinlime/contracts"

export const channelsRouter = router({
  create: authedProcedure
    .input(createChannelInput)
    .mutation(async ({ ctx, input }) => {
      // Only project owners can create channels — walk buildUnit → project
      const [buildUnit] = await ctx.db
        .select({ project_id: buildUnitsTable.project_id })
        .from(buildUnitsTable)
        .where(eq(buildUnitsTable.id, input.buildunit_id))
      if (!buildUnit) {
        throw new TRPCError({ code: `NOT_FOUND`, message: `Build unit not found` })
      }
      const [project] = await ctx.db
        .select({ owner_id: projectsTable.owner_id })
        .from(projectsTable)
        .where(eq(projectsTable.id, buildUnit.project_id))
      if (!project) {
        throw new TRPCError({ code: `NOT_FOUND`, message: `Project not found` })
      }
      if (project.owner_id !== ctx.session.user.id) {
        throw new TRPCError({ code: `FORBIDDEN`, message: `Only project owners can create channels` })
      }

      // Prevent duplicate channel names within the same build unit.
      //
      // isNull(deleted_at) is load-bearing: a SOFT-DELETED channel must RELEASE its
      // name. Without it, deleting a channel permanently burns that name for the
      // build unit — the row still matches here, so the create is rejected with
      // "already exists" while the user can see no such channel anywhere (the
      // channels shape filters deleted_at IS NULL, so it is not even synced to them).
      // That is an unrecoverable dead end from the user's side.
      //
      // Same predicate, same reason as the tasks table's partial unique index
      // `(channel_id, lower(name)) WHERE deleted_at IS NULL` — see ARCHITECTURE §4,
      // which calls that WHERE clause out explicitly for letting a deleted task
      // release its name.
      const [duplicate] = await ctx.db
        .select({ id: channelsTable.id })
        .from(channelsTable)
        .where(and(
          eq(channelsTable.buildunit_id, input.buildunit_id),
          isNull(channelsTable.deleted_at),
          sql`CAST(${channelsTable.name} AS text) = ${JSON.stringify(input.name)}`
        ))
      if (duplicate) {
        throw new TRPCError({ code: `CONFLICT`, message: `A ${input.name} channel already exists in this build unit` })
      }

      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        const [newItem] = await tx
          .insert(channelsTable)
          .values(input)
          .returning()

        // Auto-add the channel owner as a member with role 'owner'
        await tx.insert(membershipTable).values({
          id: crypto.randomUUID(),
          user_id: ctx.session.user.id,
          channel_id: newItem.id,
          buildunit_id: input.buildunit_id,
          project_id: buildUnit.project_id,
          member_flag: true,
          role: `owner`,
        })

        return { item: newItem, txid }
      })

      return result
    }),

  update: authedProcedure
    .input(updateChannelInput)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        const [updatedItem] = await tx
          .update(channelsTable)
          .set(input.data)
          .where(
            and(
              eq(channelsTable.id, input.id),
              eq(channelsTable.owner_id, ctx.session.user.id)
            )
          )
          .returning()

        if (!updatedItem) {
          throw new TRPCError({
            code: `NOT_FOUND`,
            message: `Channel not found or you do not have permission to update it`,
          })
        }

        return { item: updatedItem, txid }
      })

      return result
    }),

  addMember: authedProcedure
    .input(z.object({ channelId: z.string(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Fetch channel to get buildunit_id and owner_id
      const [channel] = await ctx.db
        .select({ buildunit_id: channelsTable.buildunit_id, owner_id: channelsTable.owner_id })
        .from(channelsTable)
        .where(eq(channelsTable.id, input.channelId))
      if (!channel) {
        throw new TRPCError({ code: `NOT_FOUND`, message: `Channel not found` })
      }
      if (channel.owner_id !== ctx.session.user.id) {
        throw new TRPCError({ code: `FORBIDDEN`, message: `Only the channel owner can add members` })
      }

      // Fetch build unit to get project_id
      const [buildUnit] = await ctx.db
        .select({ project_id: buildUnitsTable.project_id })
        .from(buildUnitsTable)
        .where(eq(buildUnitsTable.id, channel.buildunit_id))
      if (!buildUnit) {
        throw new TRPCError({ code: `NOT_FOUND`, message: `Build unit not found` })
      }

      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)

        // Check for existing membership record
        const [existing] = await tx
          .select({ id: membershipTable.id, member_flag: membershipTable.member_flag })
          .from(membershipTable)
          .where(
            and(
              eq(membershipTable.user_id, input.userId),
              eq(membershipTable.channel_id, input.channelId)
            )
          )

        if (existing) {
          if (existing.member_flag) {
            throw new TRPCError({ code: `CONFLICT`, message: `ALREADY_MEMBER` })
          }
          // Re-activate removed membership
          const [updated] = await tx
            .update(membershipTable)
            .set({ member_flag: true, role: `viewer` })
            .where(eq(membershipTable.id, existing.id))
            .returning()
          return { item: updated, txid }
        }

        // Insert new membership
        const [inserted] = await tx
          .insert(membershipTable)
          .values({
            id: crypto.randomUUID(),
            user_id: input.userId,
            channel_id: input.channelId,
            buildunit_id: channel.buildunit_id,
            project_id: buildUnit.project_id,
            member_flag: true,
            role: `viewer`,
          })
          .returning()
        return { item: inserted, txid }
      })

      return result
    }),

  removeMember: authedProcedure
    .input(z.object({ channelId: z.string(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [channel] = await ctx.db
        .select({ owner_id: channelsTable.owner_id })
        .from(channelsTable)
        .where(eq(channelsTable.id, input.channelId))
      if (!channel) {
        throw new TRPCError({ code: `NOT_FOUND`, message: `Channel not found` })
      }
      if (channel.owner_id !== ctx.session.user.id) {
        throw new TRPCError({ code: `FORBIDDEN`, message: `Only the channel owner can remove members` })
      }
      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        await tx
          .update(membershipTable)
          .set({ member_flag: false })
          .where(
            and(
              eq(membershipTable.user_id, input.userId),
              eq(membershipTable.channel_id, input.channelId)
            )
          )
        return { txid }
      })
      return result
    }),

  /**
   * SOFT delete, owner-only, cascading to its tasks and resources. Same design as
   * projects.delete — see the long note there. Messages in the channel are left
   * intact (redacted-in-place elsewhere) and become unreachable once the channel
   * drops out of channelsShape.
   */
  delete: authedProcedure
    .input(deleteChannelInput)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)

        const [channel] = await tx
          .select()
          .from(channelsTable)
          .where(eq(channelsTable.id, input.id))

        if (!channel || channel.owner_id !== ctx.session.user.id) {
          throw new TRPCError({
            code: `NOT_FOUND`,
            message: `Channel not found or you do not have permission to delete it`,
          })
        }

        if (channel.deleted_at) return { item: channel, txid }

        const stamp = { deleted_at: new Date(), deleted_by_id: ctx.session.user.id }

        const [deletedItem] = await tx
          .update(channelsTable)
          .set(stamp)
          .where(eq(channelsTable.id, input.id))
          .returning()

        await tx
          .update(tasksTable)
          .set(stamp)
          .where(and(eq(tasksTable.channel_id, input.id), isNull(tasksTable.deleted_at)))

        await tx
          .update(resourcesTable)
          .set(stamp)
          .where(and(eq(resourcesTable.channel_id, input.id), isNull(resourcesTable.deleted_at)))

        return { item: deletedItem, txid }
      })

      return result
    }),
})
