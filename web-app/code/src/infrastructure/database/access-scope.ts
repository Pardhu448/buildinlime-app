import { eq, and } from "drizzle-orm"
import { db } from "./connection"
import { membershipTable, channelsTable } from "./schema/admin-schema"

export type MemberScope = {
  channelIds: string[]
  buildunitIds: string[]
  projectIds: string[]
}

/**
 * Single source of truth for Electric-shape authorization on the content routes
 * (messages / tasks / resources / properties) and /api/memberships.
 *
 * Resolves the set of channels — and their parent buildunits/projects — a user
 * is entitled to, from the SESSION only, never from client input. A user is
 * entitled to a channel if they hold an active membership row (member_flag =
 * true) OR they own the channel. This closes the IDOR where routes trusted a
 * client-supplied `member_*_ids` list and only checked UUID format.
 *
 * project/buildunit ids come from the membership rows (owners get a membership
 * row on channel creation, so ownership is already covered there); the owned-
 * channels query is a defensive union so an owner without a membership row still
 * sees their own channel.
 */
export async function resolveMemberScope(userId: string): Promise<MemberScope> {
  const [memberships, ownedChannels] = await Promise.all([
    db
      .select({
        channel_id: membershipTable.channel_id,
        buildunit_id: membershipTable.buildunit_id,
        project_id: membershipTable.project_id,
      })
      .from(membershipTable)
      .where(
        and(
          eq(membershipTable.user_id, userId),
          eq(membershipTable.member_flag, true),
        ),
      ),
    db
      .select({
        channel_id: channelsTable.id,
        buildunit_id: channelsTable.buildunit_id,
      })
      .from(channelsTable)
      .where(eq(channelsTable.owner_id, userId)),
  ])

  const channelIds = new Set<string>()
  const buildunitIds = new Set<string>()
  const projectIds = new Set<string>()
  for (const m of memberships) {
    channelIds.add(m.channel_id)
    buildunitIds.add(m.buildunit_id)
    projectIds.add(m.project_id)
  }
  for (const c of ownedChannels) {
    channelIds.add(c.channel_id)
    buildunitIds.add(c.buildunit_id)
  }

  return {
    channelIds: [...channelIds],
    buildunitIds: [...buildunitIds],
    projectIds: [...projectIds],
  }
}
