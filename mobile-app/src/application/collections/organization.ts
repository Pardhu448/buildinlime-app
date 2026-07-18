import {
  projectRowSchema,
  buildUnitRowSchema,
  channelRowSchema,
  membershipRowSchema,
} from "@buildinlime/contracts"
import { getPersistence } from "../../infrastructure/persistence/expo-persistence"
import {
  defineCollection,
  retryOnMembershipsError,
  NEVER_GC,
  safeCleanup,
} from "./_shared"

// Row schemas come from @buildinlime/contracts — one copy, shared with web and
// asserted against the drizzle tables server-side. See ARCHITECTURE.md §10.

// ---------------------------------------------------------------------------
// Factory functions — collections are created AFTER memberships load so that
// membership-derived IDs can be baked into the shape URLs. This eliminates
// the per-poll membership table scan on the server side.
// ---------------------------------------------------------------------------

function _makeProjectsCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
  memberProjectIds: string[],
) {
  return defineCollection({
    id: `projects`,
    path: `/api/projects`,
    params: { member_ids: memberProjectIds },
    schema: projectRowSchema,
    getKey: (item: { id: string }) => item.id,
    gcTime: NEVER_GC,
    persistence,
    // No handlers — read-only on mobile; projects are managed on web.
  })
}

function _makeBuildUnitsCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
  memberBuildunitIds: string[],
) {
  return defineCollection({
    id: `build-units`,
    path: `/api/buildunits`,
    params: { member_ids: memberBuildunitIds },
    schema: buildUnitRowSchema,
    getKey: (item: { id: string }) => item.id,
    gcTime: NEVER_GC,
    persistence,
    // No handlers — read-only on mobile; build units are managed on web.
  })
}

function _makeChannelsCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
  memberChannelIds: string[],
) {
  return defineCollection({
    id: `channels`,
    path: `/api/channels`,
    params: { member_ids: memberChannelIds },
    schema: channelRowSchema,
    getKey: (item: { id: string }) => item.id,
    gcTime: NEVER_GC,
    persistence,
    // No handlers — read-only on mobile; channels are managed on web.
  })
}

/**
 * The ROSTER stream: every member of every channel this user can see.
 *
 * This is NOT membershipsCollection. That one is the SELF stream — the server
 * scopes it `user_id = me`, so it holds only your own rows and can never tell you
 * who else is in a channel. Anything that renders other people (the assignee
 * picker, member lists) needs this collection instead. Mirrors web's
 * channelMembersCollection; both hit the same `memberships` table with a wider
 * where clause, and both validate against the one shared membershipRowSchema.
 *
 * The channel ids are baked into the shape URL, so this must be rebuilt whenever
 * the visible channel set changes — same lifecycle as channelsCollection, which is
 * why it lives here and not in admin.ts alongside the self stream.
 */
function _makeChannelMembersCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
  memberChannelIds: string[],
) {
  return defineCollection({
    id: `channel-members`,
    path: `/api/channel-members`,
    // Note the param name: this route takes `channel_ids`, not the `member_ids` the
    // projects/buildunits/channels routes take.
    params: { channel_ids: memberChannelIds },
    schema: membershipRowSchema,
    getKey: (item: { id: string }) => item.id,
    gcTime: NEVER_GC,
    persistence,
  })
}

/**
 * The current user's SELF membership stream — scoped `user_id = me` server-side,
 * so it takes no id parameters and never rebuilds on scope change.
 *
 * This is the collection every other scoped shape derives its id sets from, which
 * is why it loads first and why its errors are tracked: see loadMembershipsCollection
 * in ./init and retryOnMembershipsError in ./_shared.
 */
function _makeMembershipsCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
) {
  return defineCollection({
    id: `memberships`,
    path: `/api/memberships`,
    schema: membershipRowSchema,
    getKey: (item: { id: string }) => item.id,
    gcTime: NEVER_GC,
    persistence,
    // Reports the error before retrying, so the bootstrap can tell a clean empty
    // sync apart from a shape that failed and was marked ready anyway — see
    // retryOnMembershipsError.
    onError: retryOnMembershipsError,
  })
}

// ---------------------------------------------------------------------------
// Deferred exports — initialized by initializeOrganizationCollections()
// after memberships preload.
// ---------------------------------------------------------------------------
export let membershipsCollection: ReturnType<typeof _makeMembershipsCollection> = null!
export let projectsCollection: ReturnType<typeof _makeProjectsCollection> = null!
export let buildUnitsCollection: ReturnType<typeof _makeBuildUnitsCollection> = null!
export let channelsCollection: ReturnType<typeof _makeChannelsCollection> = null!
export let channelMembersCollection: ReturnType<typeof _makeChannelMembersCollection> = null!

// Memberships loads FIRST in bootstrap — every other scoped collection derives
// its shape ids from it. See initBootstrapCollections in ./init.
export function initializeMembershipsCollection() {
  const { persistence } = getPersistence()
  safeCleanup(membershipsCollection)
  membershipsCollection = _makeMembershipsCollection(persistence)
}

// Standalone init for the projects collection — called during bootstrap
// (before a project is selected) so the picker can render all user projects.
export function initializeProjectsCollection(memberProjectIds: string[] = []) {
  if (projectsCollection) return
  const { persistence } = getPersistence()
  projectsCollection = _makeProjectsCollection(persistence, memberProjectIds)
}

export function initializeOrganizationCollections(params: {
  memberProjectIds: string[]
  memberBuildunitIds: string[]
  memberChannelIds: string[]
}) {
  const { persistence } = getPersistence()
  // Projects may already be initialized by bootstrap — only create if missing
  if (!projectsCollection) {
    projectsCollection = _makeProjectsCollection(persistence, params.memberProjectIds)
  }
  // On a project switch these hold the previous project's collections; stop
  // their sync before replacing (GC is disabled, so it won't happen for us).
  safeCleanup(buildUnitsCollection)
  safeCleanup(channelsCollection)
  buildUnitsCollection = _makeBuildUnitsCollection(persistence, params.memberBuildunitIds)
  channelsCollection = _makeChannelsCollection(persistence, params.memberChannelIds)
  initializeChannelMembersCollection(params.memberChannelIds)
}

/**
 * Create (or recreate) the roster collection for a channel-id set.
 *
 * Deliberately NOT folded into reinitializeScopedOrganizationCollections, which
 * only runs when the non-owner visibility set changes. `/api/channel-members` has
 * no owner escape hatch — its where clause is a bare `channel_id = ANY(...)` — so
 * a channel you own and created yourself flips channelKey without flipping
 * visibilityKey, and the roster would silently miss its members. It rebuilds on
 * EITHER key changing, like properties.
 */
export function initializeChannelMembersCollection(memberChannelIds: string[]) {
  const { persistence } = getPersistence()
  safeCleanup(channelMembersCollection)
  channelMembersCollection = _makeChannelMembersCollection(persistence, memberChannelIds)
}

// Rebuild ONLY the projects collection with a fresh (global) member-project id
// set. Used by resyncProjectCollections when the user's visible project list
// changes at runtime. Stops the previous instance's sync before replacing it.
export function reinitializeProjectsCollection(memberProjectIds: string[]) {
  const { persistence } = getPersistence()
  safeCleanup(projectsCollection)
  projectsCollection = _makeProjectsCollection(persistence, memberProjectIds)
}

// Rebuild the build-units + channels collections for the currently-selected
// project with a fresh (scoped) member-id set. Used by resyncProjectCollections
// when the user's visible build-unit/channel set changes at runtime. Stops the
// previous instances' sync before replacing them.
export function reinitializeScopedOrganizationCollections(params: {
  memberBuildunitIds: string[]
  memberChannelIds: string[]
}) {
  const { persistence } = getPersistence()
  safeCleanup(buildUnitsCollection)
  safeCleanup(channelsCollection)
  buildUnitsCollection = _makeBuildUnitsCollection(persistence, params.memberBuildunitIds)
  channelsCollection = _makeChannelsCollection(persistence, params.memberChannelIds)
}

export function resetOrganizationCollections() {
  // Stop sync before dropping the references (GC won't do it — it's disabled).
  safeCleanup(membershipsCollection)
  safeCleanup(projectsCollection)
  safeCleanup(buildUnitsCollection)
  safeCleanup(channelsCollection)
  safeCleanup(channelMembersCollection)
  membershipsCollection = null!
  projectsCollection = null!
  buildUnitsCollection = null!
  channelsCollection = null!
  channelMembersCollection = null!
}
