import {
  initializeUsersCollection,
  resetAdminCollections,
  usersCollection,
} from "./admin"
import {
  initializeMembershipsCollection,
  initializeProjectsCollection,
  initializeOrganizationCollections,
  initializeChannelMembersCollection,
  reinitializeProjectsCollection,
  reinitializeScopedOrganizationCollections,
  resetOrganizationCollections,
  membershipsCollection,
  projectsCollection,
  buildUnitsCollection,
  channelsCollection,
  channelMembersCollection,
} from "./organization"
import {
  initializeCommunicationCollections,
  initializePropertiesCollection,
  initializeSeenStateCollection,
  resetCommunicationCollections,
  seenStateCollection,
  tasksCollection,
  messagesCollection,
  resourcesCollection,
  propertiesCollection,
  inboxMentionsCollection,
  myTasksCollection,
} from "./communication"
import { membershipsShapeErrored, clearMembershipsShapeError } from "./_shared"
import { ensureCleanPersistenceForUser } from "../../infrastructure/persistence/expo-persistence"

// Memberships is the ONE collection both bootstrap phases derive their scope
// from, so it gets its own load gate. The obvious one — wait until isReady() —
// is a trap: Electric marks a collection ready from its shape ERROR path as well
// as on up-to-date (see retryOnMembershipsError). A single shape error — a 401
// mid token-refresh, a dropped connection on mobile data, a server blip — lands
// instantly on "ready" with ZERO rows. deriveMembershipSets() then yields empty
// id sets, and every channel-scoped shape is built as `1 = 0`: no messages,
// tasks or resources for the rest of the session. The owner still sees their
// projects and channels via the `owner_id = me` clause, so the drawer looks fine
// while every channel is empty.
//
// Wait for a TRUSTWORTHY result instead:
//   - rows arrived                  → done
//   - ready, no rows, no error      → done; this user genuinely has no
//                                     memberships (a brand-new account) and must
//                                     not be made to wait
//   - ready, no rows, shape errored → keep waiting; the shape retries in the
//                                     background (retryOnError backs off)
//
// The wait is BOUNDED — login must never hang. Proceeding with an empty set is
// survivable because it is no longer terminal: the one-shot re-check in
// (tabs)/_layout.tsx re-derives the sets once init completes and resyncs if the
// rows landed late.
async function loadMembershipsCollection(timeoutMs = 10000): Promise<void> {
  clearMembershipsShapeError()
  membershipsCollection.startSyncImmediate()

  const deadline = Date.now() + timeoutMs
  const trustworthy = () =>
    membershipsCollection.size > 0 ||
    (membershipsCollection.isReady() && !membershipsShapeErrored())

  while (!trustworthy() && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 30))
  }

  if (__DEV__) {
    const source = membershipsCollection.size > 0
      ? `rows`
      : trustworthy()
        ? `empty (clean sync)`
        : `empty (SHAPE ERRORED — will self-heal on resync)`
    console.log(`[collections] memberships: ${membershipsCollection.size} rows (${source})`)
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
export async function initBootstrapCollections(userId: string): Promise<void> {
  const t0 = __DEV__ ? Date.now() : 0

  // Wipe the local DB if it belongs to a different user BEFORE any collection
  // opens it — otherwise the new user can inherit stale rows and, worse, stale
  // Electric sync offsets that suppress their own rows. See
  // ensureCleanPersistenceForUser.
  await ensureCleanPersistenceForUser(userId)

  initializeMembershipsCollection()
  await loadMembershipsCollection()

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

  // Seen state is scoped `user_id = me` server-side, not by membership, so it
  // belongs in bootstrap alongside users — it takes no id sets and never needs
  // rebuilding when the visible channel set changes.
  initializeSeenStateCollection()
  seenStateCollection.startSyncImmediate()

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
// properties — all filtered to a single project.
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

  // Properties are scoped by entity_id + channel_id (no task-id dependency), so
  // they start in the same parallel batch — no need to wait for tasks to land.
  buildUnitsCollection.startSyncImmediate()
  channelsCollection.startSyncImmediate()
  channelMembersCollection.startSyncImmediate()
  tasksCollection.startSyncImmediate()
  messagesCollection.startSyncImmediate()
  resourcesCollection.startSyncImmediate()
  propertiesCollection.startSyncImmediate()
  // Badge slices — created inside initializeCommunicationCollections above.
  inboxMentionsCollection.startSyncImmediate()
  myTasksCollection.startSyncImmediate()

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
// to / removed from one) without a fresh login. Returns true if anything was
// rebuilt.
//
// This is the ONLY path that rebuilds collections mid-session: there is no
// project switch (see the drawer's "Sign out to switch project"), so anything
// that has to survive a rebuild hangs off this, not off a project change.
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
    inboxMentionsCollection.startSyncImmediate()
    myTasksCollection.startSyncImmediate()
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
