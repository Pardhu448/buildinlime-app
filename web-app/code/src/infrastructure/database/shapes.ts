// Every Electric shape's authorization rule, in one file. This is the audit
// surface: if you want to know what a given table exposes and to whom, it is
// one entry here, not one file per route in the routes tree.
//
// Four shapes still derive their channel scope from a client-supplied query
// param rather than from the session (marked ⚠️ CLIENT-SCOPED below). That is
// pre-existing behaviour, carried over unchanged by the refactor that created
// this file; each one carries the exact change that closes it.

import {
  and,
  or,
  isMe,
  arrayContains,
  notDeleted,
  idSetWhere,
  idSetOrOmit,
  parseIdList,
  UUID_REGEX,
} from "./shape-where"
// TYPE-ONLY on purpose: it keeps this module free of any runtime dependency on
// shape-route (and so on auth/server and the db pool), which is what lets the
// descriptors be unit-tested as pure functions. See tests/unit/shapes.test.ts.
import type { ShapeDef } from "./shape-route"

// ---------------------------------------------------------------------------
// Purely user-scoped — no membership query, `where` depends only on the session.
// ---------------------------------------------------------------------------

/** Every user, unscoped: the directory that backs mention and assignee pickers. */
export const usersShape: ShapeDef = {
  table: `users`,
}

/**
 * STABLE self-membership stream.
 *
 * The where clause depends only on session.user.id — a value that never changes
 * for the life of the session — so it is byte-identical on every long-poll. That
 * keeps Electric's shape handle stable (no churn / 409 must-refetch), and ANY new
 * membership row for this user, on ANY channel, matches immediately and streams
 * in live. This is the bootstrap source that drives membership-derived visibility
 * and the downstream recreation trigger.
 *
 * Roster display (OTHER users' rows) is served separately by channelMembersShape,
 * so this hot path needs no DB query.
 */
export const membershipsShape: ShapeDef = {
  table: `memberships`,
  where: ({ userId }) => and(isMe(`user_id`, userId), `member_flag = true`),
}

/**
 * A user's own "last seen" markers, and only their own. The `user_id = me` clause
 * is unconditional — there is no query parameter to widen it, and a seen marker is
 * private, so updating it syncs to nobody else.
 */
export const seenStateShape: ShapeDef = {
  table: `seen_state`,
  where: ({ userId }) => isMe(`user_id`, userId),
}

/** Teams the caller owns. */
export const teamsShape: ShapeDef = {
  table: `teams`,
  where: ({ userId }) => isMe(`owner_id`, userId),
}

/**
 * A user's own read state — the per-item predecessor to seenStateShape.
 *
 * DEAD as far as the clients go: nothing imports a reads collection on either app
 * any more, and the only surviving references to /api/reads are in the generated
 * routeTree. Kept here only so the route it backs stays consistent with the other
 * fourteen; removing route + descriptor together is a separate change.
 */
export const readsShape: ShapeDef = {
  table: `reads`,
  where: ({ userId }) => isMe(`user_id`, userId),
}

// ---------------------------------------------------------------------------
// Owner-escape collections — you always see what you own, even before anyone
// grants you membership. ARCHITECTURE.md §4.
// ---------------------------------------------------------------------------

export const projectsShape: ShapeDef = {
  table: `projects`,
  scope: `member`,
  where: ({ userId, scope }) =>
    or(idSetOrOmit(`id`, scope.projectIds), isMe(`owner_id`, userId)),
}

export const buildUnitsShape: ShapeDef = {
  table: `build_units`,
  scope: `member`,
  where: ({ userId, scope, url }) => {
    const visible = or(
      idSetOrOmit(`id`, scope.buildunitIds),
      isMe(`owner_id`, userId),
    )
    // Optional narrowing filter (a specific project). AND-ed with the access
    // boundary above, so it can only restrict — never broaden — visibility.
    const projectId = url.searchParams.get(`project_id`)
    return and(visible, projectId && UUID_REGEX.test(projectId) && `project_id = '${projectId}'`)
  },
}

/** resolveMemberScope already unions owned channels; owner_id is defence-in-depth. */
export const channelsShape: ShapeDef = {
  table: `channels`,
  scope: `member`,
  where: ({ userId, scope }) =>
    or(idSetOrOmit(`id`, scope.channelIds), isMe(`owner_id`, userId)),
}

// ---------------------------------------------------------------------------
// Channel-scoped collections — NO owner escape hatch. Scoped purely by the
// visible channel id set, so idSetWhere's `1 = 0` on empty is the default-deny.
// ---------------------------------------------------------------------------

/**
 * Soft-deleted tasks are filtered out HERE, not in the UI. A deleted task falls
 * out of the shape, Electric delivers that to clients as a delete, and it
 * disappears from every screen at once — the sheet, My Tasks, the badges — with
 * no per-call-site filter to forget.
 */
export const tasksShape: ShapeDef = {
  table: `tasks`,
  scope: `member`,
  where: ({ scope }) => and(idSetWhere(`channel_id`, scope.channelIds), notDeleted),
}

/** Same soft-delete treatment as tasks — see above. */
export const resourcesShape: ShapeDef = {
  table: `resources`,
  scope: `member`,
  where: ({ scope }) => and(idSetWhere(`channel_id`, scope.channelIds), notDeleted),
}

/**
 * DELIBERATELY NO `deleted_at IS NULL` HERE — unlike tasks and resources.
 *
 * Replies hang off a message via parent_id, and the client builds its thread list
 * from roots and buckets the rest under their parent. Drop a deleted parent out of
 * the shape and its replies are orphaned: an entire conversation silently
 * disappears. So a deleted message keeps syncing and the client renders a
 * tombstone. Nothing sensitive rides along — messages.delete REDACTS the row in
 * place. Adding the filter here would look like a tightening and would in fact
 * destroy threads.
 *
 * ⚠️ CLIENT-SCOPED. This is the IDOR that projects/buildunits/channels/tasks/
 * resources/properties already had closed; messages was missed. To close it:
 *
 *     scope: `member`,
 *     where: ({ scope }) => idSetWhere(`channel_id`, scope.channelIds),
 */
export const messagesShape: ShapeDef = {
  table: `messages`,
  where: ({ url }) =>
    idSetWhere(`channel_id`, parseIdList(url.searchParams.get(`member_channel_ids`))),
}

/**
 * Property rows attach to an entity via `entity_id`, which may be a project,
 * buildunit, channel, or task id. Two orthogonal scopes, OR'd:
 *   - Project & build-unit properties matched by entity_id (they have no channel).
 *   - Channel & task properties matched by the denormalized channel_id — the same
 *     scope as tasks/messages — so a new task's properties in a visible channel
 *     are covered with no collection rebuild.
 * Plus an owner escape hatch: properties YOU created sync even on an entity with
 * no membership yet, mirroring `owner_id = me` on the entity shapes.
 */
export const propertiesShape: ShapeDef = {
  table: `properties`,
  scope: `member`,
  where: ({ userId, scope }) =>
    or(
      idSetOrOmit(`entity_id`, [...new Set([...scope.projectIds, ...scope.buildunitIds])]),
      idSetOrOmit(`channel_id`, scope.channelIds),
      isMe(`createdby_id`, userId),
    ),
}

// ---------------------------------------------------------------------------
// User-scoped slices — tiny always-mounted shapes feeding the sidebar badges.
// Both are bounded by a session-derived predicate (assignee / mention), so the
// client-supplied channel ids can only narrow what the caller already sees.
// Switching them to `scope: "member"` is still strictly correct and removes the
// last client-scoped surfaces; it costs one resolveMemberScope query each.
// ---------------------------------------------------------------------------

/** ⚠️ CLIENT-SCOPED, bounded by `assignee_id = me`. */
export const myTasksShape: ShapeDef = {
  table: `tasks`,
  where: ({ userId, url }) =>
    and(
      idSetWhere(`channel_id`, parseIdList(url.searchParams.get(`member_channel_ids`))),
      isMe(`assignee_id`, userId),
      notDeleted,
    ),
}

/** ⚠️ CLIENT-SCOPED, bounded by `mention_ids @> me`. */
export const inboxMentionsShape: ShapeDef = {
  table: `messages`,
  where: ({ userId, url }) =>
    and(
      idSetWhere(`channel_id`, parseIdList(url.searchParams.get(`member_channel_ids`))),
      arrayContains(`mention_ids`, userId),
    ),
}

/**
 * The ROSTER stream: every active membership for the channels this user can see,
 * used only to display who is in a channel (member lists, add/remove UI, assignee
 * pickers). Shares the `memberships` table with membershipsShape but is a
 * different shape — hence a separate entry.
 *
 * ⚠️ CLIENT-SCOPED, and UNBOUNDED — unlike my-tasks and inbox-mentions there is no
 * session-derived predicate narrowing it, so any authenticated caller can read any
 * channel's roster. The route's own comment flags this and says to lock it down
 * together with projects/buildunits/channels; those were done, this was not. Close
 * it the same way as messages:
 *
 *     scope: `member`,
 *     where: ({ scope }) =>
 *       and(idSetWhere(`channel_id`, scope.channelIds), `member_flag = true`),
 *
 * Note the empty-set case changes from `false` to `1 = 0`. Both are well-formed
 * predicates that match nothing, which is what the Electric client needs in order
 * to resume — a bare `[]` body is what it cannot handle.
 */
export const channelMembersShape: ShapeDef = {
  table: `memberships`,
  where: ({ url }) => {
    const channelIds = parseIdList(url.searchParams.get(`channel_ids`))
    return channelIds.length > 0
      ? and(idSetWhere(`channel_id`, channelIds), `member_flag = true`)
      : `false`
  },
}
