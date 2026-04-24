import type { Collection } from "@tanstack/react-db"
import {
  initializeMembershipsCollection,
  initializeUsersCollection,
  initializeTeamsCollection,
  resetAdminCollections,
  membershipsCollection,
  usersCollection,
  teamsCollection,
} from "./admin"
import {
  initializeProjectsCollection,
  initializeOrganizationCollections,
  resetOrganizationCollections,
  projectsCollection,
  buildUnitsCollection,
  channelsCollection,
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
  initializeTeamsCollection()

  buildUnitsCollection.startSyncImmediate()
  channelsCollection.startSyncImmediate()
  teamsCollection.startSyncImmediate()
  messagesCollection.startSyncImmediate()
  resourcesCollection.startSyncImmediate()

  // Properties depend on task IDs — wait for tasks to land, then init.
  await loadCollection(tasksCollection)
  const memberTaskIds = [
    ...new Set(
      (tasksCollection.toArray as unknown as Array<{ id: string }>).map((t) => t.id)
    ),
  ].sort()
  initializePropertiesCollection({ ...membershipParams, memberTaskIds })
  propertiesCollection.startSyncImmediate()

  if (__DEV__) {
    console.log(`[collections] Project collections ready in ${Date.now() - t0}ms (project=${projectId})`)
  }
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
  if (__DEV__) console.log(`[collections] All collection references reset`)
}
