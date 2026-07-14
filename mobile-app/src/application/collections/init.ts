import type { Collection } from "@tanstack/react-db"
import {
  initializeMembershipsCollection,
  initializeUsersCollection,
  initializeTeamsCollection,
  initializeReadsCollection,
  resetAdminCollections,
  membershipsCollection,
  usersCollection,
  teamsCollection,
  readsCollection,
} from "./admin"
import {
  initializeProjectsCollection,
  initializeOrganizationCollections,
  initializeChannelMembersCollection,
  reinitializeProjectsCollection,
  reinitializeScopedOrganizationCollections,
  resetOrganizationCollections,
  projectsCollection,
  buildUnitsCollection,
  channelsCollection,
  channelMembersCollection,
} from "./organization"
import {
  initializeCommunicationCollections,
  initializePropertiesCollection,
  resetCommunicationCollections,
  tasksCollection,
  messagesCollection,
  resourcesCollection,
  propertiesCollection,
} from "./communication"

// Start sync on a collection and wait for the initial Electric snapshot
// to land (or for the timeout, whichever comes first). Persisted collections
// hydrate from the local SQLite cache first, so this often resolves instantly.
async function loadCollection(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  collection: Collection<any, any, any>,
  timeoutMs = 5000
): Promise<void> {
  collection.startSyncImmediate()
  if (collection.size > 0 || collection.isReady()) return

  const deadline = Date.now() + timeoutMs
  while (collection.size === 0 && !collection.isReady() && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 30))
  }
}

// ---------------------------------------------------------------------------
// Membership-derived scope + change detection (mobile port of the web app's
// membership-staleness rework). The self-membership stream (user_id = me) is
// the source of truth for what this user can see. Collections bake membership-
// derived ids into their shape URLs at build time, so when the visible scope
// changes at runtime — the user creates a channel, or is added to / removed
// from one — the live collections go stale until they are rebuilt.
//
// Two change keys decide what a membership change must rebuild:
//   - visibilityKey (NON-owner memberships): the global project list plus the
//     current project's build-units/channels. Owned entities already arrive via
//     the server's `owner_id = me` shape clause, so creating your OWN does not
//     churn these — only gaining/losing access to something you don't own does.
//   - channelKey (ALL of the current project's channels): the channel-scoped
//     collections (tasks/messages/resources, and properties). Their shapes have
//     no owner escape hatch, so they must rebuild whenever the visible channel
//     set changes, including when you create your own channel.
//
// Mobile differs from web in being project-scoped: build-units/channels/tasks/
// messages/resources/properties are all filtered to the selected project, while
// the projects collection spans every project the user belongs to.
// ---------------------------------------------------------------------------

type MembershipRow = {
  project_id: string
  buildunit_id: string
  channel_id: string
  role: string
}

type DerivedSets = {
  memberProjectIds: string[] // global — drives the projects collection / picker
  memberBuildunitIds: string[] // scoped to the selected project
  memberChannelIds: string[] // scoped to the selected project
  visibilityKey: string
  channelKey: string
}

const uniqSorted = (xs: string[]) => [...new Set(xs)].sort()

function deriveMembershipSets(projectId: string | null): DerivedSets {
  const memberships = membershipsCollection.toArray as unknown as MembershipRow[]
  const scoped = projectId ? memberships.filter((m) => m.project_id === projectId) : []
  const nonOwnerAll = memberships.filter((m) => m.role !== `owner`)
  const nonOwnerScoped = scoped.filter((m) => m.role !== `owner`)
  const memberChannelIds = uniqSorted(scoped.map((m) => m.channel_id))
  return {
    memberProjectIds: uniqSorted(memberships.map((m) => m.project_id)),
    memberBuildunitIds: uniqSorted(scoped.map((m) => m.buildunit_id)),
    memberChannelIds,
    visibilityKey: JSON.stringify([
      uniqSorted(nonOwnerAll.map((m) => m.project_id)),
      uniqSorted(nonOwnerScoped.map((m) => m.buildunit_id)),
      uniqSorted(nonOwnerScoped.map((m) => m.channel_id)),
    ]),
    channelKey: JSON.stringify(memberChannelIds),
  }
}

// The sets the currently-live collections were built with. Lets a self-
// membership change be diffed to decide whether a rebuild is actually needed.
let _appliedSets: DerivedSets | null = null

// True when the visible scope has drifted from what the live collections were
// built with. Cheap to call on every membership-stream change.
export function membershipSetsChanged(projectId: string | null): boolean {
  if (!_appliedSets) return false
  const s = deriveMembershipSets(projectId)
  return s.visibilityKey !== _appliedSets.visibilityKey || s.channelKey !== _appliedSets.channelKey
}

// ---------------------------------------------------------------------------
// Phase 1 — Bootstrap: memberships + projects + users.
// Called immediately after login. Enough for the project picker screen.
// ---------------------------------------------------------------------------
export async function initBootstrapCollections(): Promise<void> {
  const t0 = __DEV__ ? Date.now() : 0

  initializeMembershipsCollection()
  await loadCollection(membershipsCollection)

  // Extract project IDs from memberships so the server returns projects
  // the user is a member of (not just projects they own).
  const memberProjectIds = [
    ...new Set(
      (membershipsCollection.toArray as unknown as Array<{ project_id: string }>)
        .map((m) => m.project_id)
    ),
  ].sort()

  initializeProjectsCollection(memberProjectIds)
  projectsCollection.startSyncImmediate()

  initializeUsersCollection()
  usersCollection.startSyncImmediate()

  // Read state is scoped `user_id = me` server-side, not by membership, so it
  // belongs in bootstrap alongside users — it takes no id sets and never needs
  // rebuilding when the visible channel set changes.
  initializeReadsCollection()
  readsCollection.startSyncImmediate()

  // Baseline for the picker (no project selected yet): a change to the global
  // project list — being added to / removed from a whole project — flips
  // visibilityKey and triggers a resync of the projects collection.
  _appliedSets = deriveMembershipSets(null)

  if (__DEV__) {
    console.log(`[collections] Bootstrap ready in ${Date.now() - t0}ms`)
  }
}

// ---------------------------------------------------------------------------
// Phase 2 — Scoped: build units, channels, tasks, messages, resources,
// properties, teams — all filtered to a single project.
// Must be called AFTER initBootstrapCollections() has completed.
// ---------------------------------------------------------------------------
export async function initProjectCollections(projectId: string): Promise<void> {
  const t0 = __DEV__ ? Date.now() : 0

  const memberships = membershipsCollection.toArray as unknown as Array<{
    project_id: string
    buildunit_id: string
    channel_id: string
  }>

  // Scope to the selected project only
  const scoped = memberships.filter((m) => m.project_id === projectId)
  const memberBuildunitIds = [...new Set(scoped.map((m) => m.buildunit_id))].sort()
  const memberChannelIds = [...new Set(scoped.map((m) => m.channel_id))].sort()
  const membershipParams = {
    memberProjectIds: [projectId],
    memberBuildunitIds,
    memberChannelIds,
  }

  initializeOrganizationCollections(membershipParams)
  initializeCommunicationCollections({ memberChannelIds })
  initializePropertiesCollection(membershipParams)
  initializeTeamsCollection()

  // Properties are scoped by entity_id + channel_id (no task-id dependency), so
  // they start in the same parallel batch — no need to wait for tasks to land.
  buildUnitsCollection.startSyncImmediate()
  channelsCollection.startSyncImmediate()
  channelMembersCollection.startSyncImmediate()
  teamsCollection.startSyncImmediate()
  tasksCollection.startSyncImmediate()
  messagesCollection.startSyncImmediate()
  resourcesCollection.startSyncImmediate()
  propertiesCollection.startSyncImmediate()

  // Record the scope these collections were built with, so a later self-
  // membership change can be diffed against it (see resyncProjectCollections).
  _appliedSets = deriveMembershipSets(projectId)

  if (__DEV__) {
    console.log(`[collections] Project collections ready in ${Date.now() - t0}ms (project=${projectId})`)
  }
}

// ---------------------------------------------------------------------------
// Resync — rebuild the membership-scoped collections in place when the current
// user's visible scope changes at runtime (they create a channel, or are added
// to / removed from one) without a fresh login or project switch. Returns true
// if anything was rebuilt.
//
// MUST run while the authenticated content is unmounted (the layout renders a
// spinner during resync), so cleanup() never runs against a collection a
// mounted live query still holds by reference. The offline executor is NOT
// touched here — it captures collection instances by value, so the caller must
// rebind it (resetAllOfflineActions + initOfflineExecutor) after this resolves,
// mirroring the Phase 2 init sequence in (tabs)/_layout.tsx.
// ---------------------------------------------------------------------------
export async function resyncProjectCollections(projectId: string | null): Promise<boolean> {
  if (!_appliedSets) return false
  const sets = deriveMembershipSets(projectId)
  const visibilityChanged = sets.visibilityKey !== _appliedSets.visibilityKey
  const channelChanged = sets.channelKey !== _appliedSets.channelKey
  if (!visibilityChanged && !channelChanged) {
    _appliedSets = sets
    return false
  }

  if (__DEV__) {
    console.log(`[collections] Resync (visibility=${visibilityChanged}, channel=${channelChanged}, project=${projectId})`)
  }

  // Owner-hatch-protected collections rebuild only when the NON-owner set
  // changes. The reinitialize*/initialize* helpers cleanup() the old instance
  // (releasing its Electric shape + SQLite handles) before creating the new one.
  if (visibilityChanged) {
    // Projects span every project the user belongs to (global scope, drives the
    // picker) — always rebuildable, even with no project selected.
    reinitializeProjectsCollection(sets.memberProjectIds)
    projectsCollection.startSyncImmediate()

    // Build-units + channels are scoped to the selected project; only rebuild
    // them once Phase 2 has created them.
    if (projectId && buildUnitsCollection && channelsCollection) {
      reinitializeScopedOrganizationCollections({
        memberBuildunitIds: sets.memberBuildunitIds,
        memberChannelIds: sets.memberChannelIds,
      })
      buildUnitsCollection.startSyncImmediate()
      channelsCollection.startSyncImmediate()
    }
  }

  // Channel-scoped collections (no owner escape hatch) rebuild whenever the
  // visible channel set changes — including creating your own channel.
  if (channelChanged && projectId && tasksCollection) {
    initializeCommunicationCollections({ memberChannelIds: sets.memberChannelIds })
    tasksCollection.startSyncImmediate()
    messagesCollection.startSyncImmediate()
    resourcesCollection.startSyncImmediate()
  }

  // The roster has no owner escape hatch (see initializeChannelMembersCollection),
  // so a channel you own yourself moves channelKey without moving visibilityKey —
  // rebuild on either, or the assignee picker misses that channel's members.
  if ((visibilityChanged || channelChanged) && projectId && channelMembersCollection) {
    initializeChannelMembersCollection(sets.memberChannelIds)
    channelMembersCollection.startSyncImmediate()
  }

  // Properties are scoped by entity_id (project/build-unit) and channel_id
  // (channel/task) — no task-id dependency — so rebuild on either change,
  // without waiting for tasks to land (only when a project is selected).
  if ((visibilityChanged || channelChanged) && projectId && propertiesCollection) {
    initializePropertiesCollection({
      memberProjectIds: [projectId],
      memberBuildunitIds: sets.memberBuildunitIds,
      memberChannelIds: sets.memberChannelIds,
    })
    propertiesCollection.startSyncImmediate()
  }

  _appliedSets = sets
  return true
}

// ---------------------------------------------------------------------------
// Reset all collection references to null so the next login cycle can
// re-initialize them with a fresh SQLite database. Must be called BEFORE
// disposePersistence() deletes the database file.
// ---------------------------------------------------------------------------
export function resetAllCollections(): void {
  resetCommunicationCollections()
  resetOrganizationCollections()
  resetAdminCollections()
  _appliedSets = null
  if (__DEV__) console.log(`[collections] All collection references reset`)
}
