import { createFileRoute, Outlet, useNavigate, redirect } from '@tanstack/react-router'
import { authClient } from '../../infrastructure/auth/client'
import { authStateCollection } from '../../infrastructure/database/tanstack-db-electric/authCollections'
import { projectsCollection, buildUnitsCollection, channelsCollection, usersCollection, teamsCollection, membershipsCollection, channelMembersCollection, initializeOrganizationCollections, initializeChannelMembersCollection, initializeUsersCollection, initializeMembershipsCollection, initializeTeamsCollection } from '../../infrastructure/database/tanstack-db-electric/admincollections'
import { initializeCommunicationCollections, initializePropertiesCollection, tasksCollection, messagesCollection, resourcesCollection, propertiesCollection } from '../../application/collections/communication'
import { debugListOPFSFiles } from '../../infrastructure/persistence/browser-persistence'
import { initOfflineExecutor, disposeOfflineExecutor } from '../../infrastructure/offline/executor'
import { useEffect, useState, useRef } from 'react'
import type { Collection } from '@tanstack/react-db'

function AuthLoadingComponent() {
  return (
    <div className="flex h-screen items-center justify-center text-[#717182] font-['Instrument_Sans',sans-serif]">
      Loading…
    </div>
  )
}

// Start sync and wait for data to appear from ANY source (OPFS cache or
// Electric network), whichever is faster. Unlike preload(), this does NOT
// block until the Electric stream finishes — it resolves as soon as rows
// hydrate from cache. Falls back to preload() only when the cache is empty
// (first-ever load) so Electric can provide the initial data.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadCollection(collection: Collection<any, any, any>, timeoutMs = 3000): Promise<void> {
  collection.startSyncImmediate()

  if (collection.size > 0 || collection.isReady()) return

  const deadline = Date.now() + timeoutMs
  while (collection.size === 0 && !collection.isReady() && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 30))
  }

  if (import.meta.env.DEV) {
    const source = collection.size > 0 ? 'cache' : collection.isReady() ? 'sync' : 'timeout'
    console.log(`[collections] ${collection.id}: ${collection.size} rows (${source})`)
  }
}

export const Route = createFileRoute('/_authenticated')({
  ssr: false,
  beforeLoad: async () => {
    const cached = authStateCollection.get(`auth`)
    let sessionData: unknown
    if (cached?.session && cached.session.expiresAt > new Date()) {
      sessionData = cached
    } else {
      const result = await authClient.getSession()

      if (authStateCollection.get(`auth`)) {
        authStateCollection.update(`auth`, (doc) => {
          doc.session = result.data?.session ?? null
          doc.user = result.data?.user ?? null
        })
      } else {
        authStateCollection.insert({ id: `auth`, ...result.data })
      }

      if (!result.data?.session) {
        throw redirect({ to: `/login` })
      }

      sessionData = result.data
    }

    return sessionData
  },
  pendingComponent: AuthLoadingComponent,
  component: AuthenticatedLayout,
})

type MembershipParams = {
  memberProjectIds: string[]
  memberBuildunitIds: string[]
  memberChannelIds: string[]
}

// Derived membership id sets. `memberProjectIds/…` feed the shape URLs.
// `visibilityKey` / `channelKey` are the change-detection keys used to decide
// what a self-membership change needs to rebuild:
//   - visibilityKey (NON-owner memberships only) → projects / build-units /
//     channels. Owned entities are already covered by the `owner_id = me` shape
//     clause, so creating your OWN (case 1) must not churn these; only gaining/
//     losing access to something you don't own (case 2) does.
//   - channelKey (ALL visible channels) → the channel-scoped collections
//     (tasks / messages / resources / channel-members, and channel/task
//     properties). These have no owner escape hatch, so they must rebuild
//     whenever the visible channel set changes — including creating your own
//     channel (case 1).
type DerivedSets = MembershipParams & {
  visibilityKey: string
  channelKey: string
}

const uniqSorted = (xs: string[]) => [...new Set(xs)].sort()

function deriveMembershipSets(): DerivedSets {
  const memberships = membershipsCollection.toArray
  const nonOwner = memberships.filter(m => m.role !== `owner`)
  const memberChannelIds = uniqSorted(memberships.map(m => m.channel_id))
  return {
    memberProjectIds: uniqSorted(memberships.map(m => m.project_id)),
    memberBuildunitIds: uniqSorted(memberships.map(m => m.buildunit_id)),
    memberChannelIds,
    visibilityKey: JSON.stringify([
      uniqSorted(nonOwner.map(m => m.project_id)),
      uniqSorted(nonOwner.map(m => m.buildunit_id)),
      uniqSorted(nonOwner.map(m => m.channel_id)),
    ]),
    channelKey: JSON.stringify(memberChannelIds),
  }
}

const toMembershipParams = (s: DerivedSets): MembershipParams => ({
  memberProjectIds: s.memberProjectIds,
  memberBuildunitIds: s.memberBuildunitIds,
  memberChannelIds: s.memberChannelIds,
})

// The sets the currently-live collections were built with. Lets a self-
// membership change be diffed to decide whether a resync is actually needed.
let _appliedSets: DerivedSets | null = null

function membershipSetsChanged(): boolean {
  if (!_appliedSets) return false
  const s = deriveMembershipSets()
  return s.visibilityKey !== _appliedSets.visibilityKey || s.channelKey !== _appliedSets.channelKey
}

async function initCollections(): Promise<void> {
  const t0 = import.meta.env.DEV ? performance.now() : 0

  // 1. Bootstrap: init the SELF membership stream (user_id = me) and wait for
  //    data (from OPFS cache or Electric).
  await initializeMembershipsCollection()
  await loadCollection(membershipsCollection)

  const sets = deriveMembershipSets()
  const membershipParams = toMembershipParams(sets)

  // 2. Create all downstream collections in parallel. Properties no longer
  //    depend on task ids (channel/task properties sync by channel_id), so they
  //    init here alongside the rest.
  await Promise.all([
    initializeOrganizationCollections(membershipParams),
    initializeChannelMembersCollection({ channelIds: sets.memberChannelIds }),
    initializeCommunicationCollections({ memberChannelIds: sets.memberChannelIds }),
    initializePropertiesCollection(membershipParams),
    initializeUsersCollection(),
    initializeTeamsCollection(),
  ])

  // 3. Start sync — OPFS hydrates from cache, Electric syncs in background.
  //    (channelsCollection is intentionally started lazily by its route loaders.)
  projectsCollection.startSyncImmediate()
  buildUnitsCollection.startSyncImmediate()
  channelMembersCollection.startSyncImmediate()
  usersCollection.startSyncImmediate()
  teamsCollection.startSyncImmediate()
  tasksCollection.startSyncImmediate()
  messagesCollection.startSyncImmediate()
  resourcesCollection.startSyncImmediate()
  propertiesCollection.startSyncImmediate()

  // 4. Offline executor — binds the collection instances BY VALUE, so it must
  //    follow collection init (and be rebound on resync). waitForInit() restores
  //    any pending outbox transactions from the previous session.
  await initOfflineExecutor()

  _appliedSets = sets

  if (import.meta.env.DEV) {
    console.log(`[collections] All initialized in ${(performance.now() - t0).toFixed(0)}ms`)
    await debugListOPFSFiles()
  }
}

// Rebuild the membership-scoped collections in place when the current user's
// visible scope changes (they created a channel, or were added to / removed
// from one). Returns true if anything was rebuilt. MUST run while the
// authenticated content is unmounted (see AuthenticatedLayout), so cleanup()
// never runs against a collection a mounted live query still references.
async function resyncCollections(): Promise<boolean> {
  if (!_appliedSets) return false
  const sets = deriveMembershipSets()
  const visibilityChanged = sets.visibilityKey !== _appliedSets.visibilityKey
  const channelChanged = sets.channelKey !== _appliedSets.channelKey
  if (!visibilityChanged && !channelChanged) return false

  if (import.meta.env.DEV) {
    console.log(`[collections] Resync (visibility=${visibilityChanged}, channel=${channelChanged})`)
  }

  const membershipParams = toMembershipParams(sets)

  // Owner-clause-protected collections: rebuild only when the NON-owner set
  // changes (case 2). cleanup() releases the old Electric shape + OPFS handles.
  if (visibilityChanged) {
    projectsCollection.cleanup()
    buildUnitsCollection.cleanup()
    channelsCollection.cleanup()
    await initializeOrganizationCollections(membershipParams)
    projectsCollection.startSyncImmediate()
    buildUnitsCollection.startSyncImmediate()
    channelsCollection.startSyncImmediate()
  }

  // Channel-scoped collections: no owner escape hatch, so rebuild whenever the
  // visible channel set changes — including when you create your OWN channel.
  if (channelChanged) {
    tasksCollection.cleanup()
    messagesCollection.cleanup()
    resourcesCollection.cleanup()
    channelMembersCollection.cleanup()
    await Promise.all([
      initializeChannelMembersCollection({ channelIds: sets.memberChannelIds }),
      initializeCommunicationCollections({ memberChannelIds: sets.memberChannelIds }),
    ])
    channelMembersCollection.startSyncImmediate()
    tasksCollection.startSyncImmediate()
    messagesCollection.startSyncImmediate()
    resourcesCollection.startSyncImmediate()
  }

  // Properties are scoped by project/build-unit ids (entity_id) and member
  // channel ids (channel_id), so rebuild on either change.
  propertiesCollection.cleanup()
  await initializePropertiesCollection(membershipParams)
  propertiesCollection.startSyncImmediate()

  // The offline executor captured the OLD tasks/messages/resources/properties
  // instances by value — rebind it to the freshly-created ones.
  disposeOfflineExecutor()
  await initOfflineExecutor()

  _appliedSets = sets
  return true
}

function AuthenticatedLayout() {
  const { data: session, isPending } = authClient.useSession()
  const navigate = useNavigate()
  const [collectionsReady, setCollectionsReady] = useState(false)
  const [dataVersion, setDataVersion] = useState(0)
  const [resyncing, setResyncing] = useState(false)
  const initStarted = useRef(false)

  useEffect(() => {
    if (!isPending && !session) {
      navigate({ to: '/login' })
    }
  }, [session, isPending, navigate])

  useEffect(() => {
    if (!session || initStarted.current) return
    initStarted.current = true
    initCollections()
      .then(() => setCollectionsReady(true))
      .catch((err) => {
        console.error(`[collections] Init failed:`, err)
        setCollectionsReady(true)
      })
  }, [session])

  // Watch the SELF membership stream (only the current user's rows), so this
  // fires only when THIS user's memberships change — creating a channel, being
  // added to / removed from one — never on roster churn. When the derived
  // visibility/channel sets actually change, flag a resync (debounced to
  // coalesce bursts).
  useEffect(() => {
    if (!collectionsReady) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const sub = membershipsCollection.subscribeChanges(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        if (membershipSetsChanged()) setResyncing(true)
      }, 400)
    })
    return () => {
      if (timer) clearTimeout(timer)
      sub.unsubscribe()
    }
  }, [collectionsReady])

  // Run the resync only AFTER the Outlet has unmounted (resyncing=true renders
  // the loading screen), so cleanup() never runs against collections that
  // mounted components still hold a reference to. Bumping dataVersion re-keys
  // the Outlet so the remounted route reads the freshly-created collections.
  useEffect(() => {
    if (!resyncing) return
    let cancelled = false
    resyncCollections()
      .then((changed) => { if (!cancelled && changed) setDataVersion(v => v + 1) })
      .catch((err) => console.error(`[collections] Resync failed:`, err))
      .finally(() => { if (!cancelled) setResyncing(false) })
    return () => { cancelled = true }
  }, [resyncing])

  if (isPending || !session) return null
  if (!collectionsReady || resyncing) return <AuthLoadingComponent />

  return <Outlet key={dataVersion} />
}
