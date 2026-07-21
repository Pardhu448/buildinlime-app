// Every Electric shape's authorization rule, in one file. This is the audit
// surface: if you want to know what a given table exposes and to whom, it is
// one entry here, not one file per route in the routes tree.
//
// EVERY shape here resolves its scope from the session. No descriptor reads an
// id set out of the query string — that is the broken-access-control shape of
// ARCHITECTURE.md §4, and `scope: "member"` exists so it does not have to.
//
// Clients still SEND member_channel_ids / channel_ids params. They are inert:
// the proxy never forwards them to Electric and no descriptor reads them. They
// remain only because they key the client's own collection rebuilds; removing
// them client-side is a follow-up.

import {
  and,
  or,
  isMe,
  arrayContains,
  notDeleted,
  idSetWhere,
  idSetOrOmit,
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

// notDeleted is AND-ed OUTSIDE the owner/member `or(...)` on all three so it can
// only ever remove rows: a soft-deleted project you own must still fall out of the
// shape, and without the outer AND the `owner_id = me` escape hatch would keep
// resurfacing it. Deleting an entity cascades the soft-delete to its descendants
// (see the routers), because these child shapes don't check a parent's deleted
// state — an undeleted build unit under a deleted project would otherwise stay
// visible via its own owner/member match.
export const projectsShape: ShapeDef = {
  table: `projects`,
  scope: `member`,
  where: ({ userId, scope }) =>
    and(or(idSetOrOmit(`id`, scope.projectIds), isMe(`owner_id`, userId)), notDeleted),
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
    return and(visible, projectId && UUID_REGEX.test(projectId) && `project_id = '${projectId}'`, notDeleted)
  },
}

/** resolveMemberScope already unions owned channels; owner_id is defence-in-depth. */
export const channelsShape: ShapeDef = {
  table: `channels`,
  scope: `member`,
  where: ({ userId, scope }) =>
    and(or(idSetOrOmit(`id`, scope.channelIds), isMe(`owner_id`, userId)), notDeleted),
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
 * The channel set is resolved server-side from the session. It used to come from
 * a client `member_channel_ids` param that was only UUID-format-checked, which
 * let any authenticated caller stream any channel's messages — the same IDOR
 * closed earlier on projects/buildunits/channels/tasks/resources/properties.
 * Message text is the most sensitive thing the system syncs, so this was the
 * worst of the four remaining instances.
 */
export const messagesShape: ShapeDef = {
  table: `messages`,
  scope: `member`,
  where: ({ scope }) => idSetWhere(`channel_id`, scope.channelIds),
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

/** Tasks assigned to the caller, in channels the caller can currently see. */
export const myTasksShape: ShapeDef = {
  table: `tasks`,
  scope: `member`,
  where: ({ userId, scope }) =>
    and(
      idSetWhere(`channel_id`, scope.channelIds),
      isMe(`assignee_id`, userId),
      notDeleted,
    ),
}

/** Messages mentioning the caller, in channels the caller can currently see. */
export const inboxMentionsShape: ShapeDef = {
  table: `messages`,
  scope: `member`,
  where: ({ userId, scope }) =>
    and(
      idSetWhere(`channel_id`, scope.channelIds),
      arrayContains(`mention_ids`, userId),
    ),
}

/**
 * The ROSTER stream: every active membership for the channels this user can see,
 * used only to display who is in a channel (member lists, add/remove UI, assignee
 * pickers). Shares the `memberships` table with membershipsShape but is a
 * different shape — hence a separate entry.
 *
 * The channel set is resolved server-side from the session. It used to come from
 * a client `channel_ids` param with no membership check, so any authenticated
 * caller could read any channel's roster — who is in it, and their roles. This
 * was the one shape with no session-derived predicate bounding it at all.
 *
 * The caller now gets the roster for every channel they can see, rather than the
 * subset they asked for. That is a superset of what the UI needs; the client's
 * own channel-id list still drives when it rebuilds the collection, it just no
 * longer decides what the server is willing to send.
 *
 * The no-visible-channels case is now `1 = 0` rather than `false` — both are
 * well-formed predicates matching nothing, which is what the Electric client
 * needs to resume from (a bare `[]` body is what it cannot handle).
 */
export const channelMembersShape: ShapeDef = {
  table: `memberships`,
  scope: `member`,
  where: ({ scope }) =>
    and(idSetWhere(`channel_id`, scope.channelIds), `member_flag = true`),
}
