import { router, authedProcedure, generateTxId } from "./lib/trpc"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { eq, and, sql } from "drizzle-orm"
import {
  channelsTable,
  buildUnitsTable,
  projectsTable,
  membershipTable,
  createChannelSchema,
  updateChannelSchema,
} from "../database/schema/admin-schema"

export const channelsRouter = router({
  create: authedProcedure
    .input(createChannelSchema)
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

      // Prevent duplicate channel names within the same build unit
      const [duplicate] = await ctx.db
        .select({ id: channelsTable.id })
        .from(channelsTable)
        .where(and(
          eq(channelsTable.buildunit_id, input.buildunit_id),
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
    .input(
      z.object({
        id: z.string(),
        data: updateChannelSchema,
      })
    )
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

  delete: authedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.transaction(async (tx) => {
        const txid = await generateTxId(tx)
        const [deletedItem] = await tx
          .delete(channelsTable)
          .where(
            and(
              eq(channelsTable.id, input.id),
              eq(channelsTable.owner_id, ctx.session.user.id)
            )
          )
          .returning()

        if (!deletedItem) {
          throw new TRPCError({
            code: `NOT_FOUND`,
            message: `Channel not found or you do not have permission to delete it`,
          })
        }

        return { item: deletedItem, txid }
      })

      return result
    }),
})
