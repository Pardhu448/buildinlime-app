import {
  projectsSpec,
  buildUnitsSpec,
  channelsSpec,
  channelMembersSpec,
  membershipsSpec,
} from "@buildinlime/sync-core"
import { getPersistence } from "../../infrastructure/persistence/expo-persistence"
import { defineCollection, retryOnMembershipsError, safeCleanup } from "./_shared"

// The descriptors (id, route, shape params, row schema, key, GC tier) live once
// in @buildinlime/sync-core — see collection-specs.ts. This file supplies only
// what is mobile's own: the persistence handle, and the memberships onError.

// ---------------------------------------------------------------------------
// Factory functions — collections are created AFTER memberships load so that
// membership-derived IDs can be baked into the shape URLs. This eliminates
// the per-poll membership table scan on the server side.
//
// None of these take handlers: the organization tables are read-only on mobile
// (projects, build units and channels are managed on web), and a missing handler
// makes a stray write fail loudly rather than silently no-op.
// ---------------------------------------------------------------------------

function _makeProjectsCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
  memberProjectIds: string[],
) {
  return defineCollection({ ...projectsSpec(memberProjectIds), persistence })
}

function _makeBuildUnitsCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
  memberBuildunitIds: string[],
) {
  return defineCollection({ ...buildUnitsSpec(memberBuildunitIds), persistence })
}

function _makeChannelsCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
  memberChannelIds: string[],
) {
  return defineCollection({ ...channelsSpec(memberChannelIds), persistence })
}

/**
 * The ROSTER stream: every member of every channel this user can see.
 *
 * The channel ids are baked into the shape URL, so this must be rebuilt whenever
 * the visible channel set changes — same lifecycle as channelsCollection, which is
 * why it lives here and not in admin.ts alongside the self stream.
 */
function _makeChannelMembersCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
  memberChannelIds: string[],
) {
  return defineCollection({ ...channelMembersSpec(memberChannelIds), persistence })
}

function _makeMembershipsCollection(
  persistence: ReturnType<typeof getPersistence>["persistence"],
) {
  return defineCollection({
    ...membershipsSpec(),
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
