import { createFileRoute, Outlet, useNavigate, redirect } from '@tanstack/react-router'
import { authClient } from '../../infrastructure/auth/client'
import { authStateCollection } from '../../infrastructure/database/tanstack-db-electric/authCollections'
import { projectsCollection, buildUnitsCollection, usersCollection, teamsCollection, membershipsCollection, initializeOrganizationCollections, initializeUsersCollection, initializeMembershipsCollection, initializeTeamsCollection } from '../../infrastructure/database/tanstack-db-electric/admincollections'
import { initializeCommunicationCollections, initializePropertiesCollection, tasksCollection, messagesCollection, resourcesCollection, propertiesCollection } from '../../application/collections/communication'
import { debugListOPFSFiles } from '../../infrastructure/persistence/browser-persistence'
import { initOfflineExecutor } from '../../infrastructure/offline/executor'
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

async function initCollections(): Promise<void> {
  const t0 = import.meta.env.DEV ? performance.now() : 0

  // 1. Bootstrap: init memberships and wait for data (from OPFS cache or Electric)
  await initializeMembershipsCollection()
  await loadCollection(membershipsCollection)

  const memberships = membershipsCollection.toArray
  const memberProjectIds = [...new Set(memberships.map(m => m.project_id))].sort()
  const memberBuildunitIds = [...new Set(memberships.map(m => m.buildunit_id))].sort()
  const memberChannelIds = [...new Set(memberships.map(m => m.channel_id))].sort()
  const membershipParams = { memberProjectIds, memberBuildunitIds, memberChannelIds }

  // 2. Create all downstream collections in parallel
  await Promise.all([
    initializeOrganizationCollections(membershipParams),
    initializeCommunicationCollections({ memberChannelIds }),
    initializeUsersCollection(),
    initializeTeamsCollection(),
  ])

  // 3. Start sync on all — OPFS hydrates from cache, Electric syncs in background.
  //    No await — UI renders with whatever data hydrates from cache.
  projectsCollection.startSyncImmediate()
  buildUnitsCollection.startSyncImmediate()
  usersCollection.startSyncImmediate()
  teamsCollection.startSyncImmediate()
  tasksCollection.startSyncImmediate()
  messagesCollection.startSyncImmediate()
  resourcesCollection.startSyncImmediate()

  // 4. Properties depend on task IDs — wait for tasks to hydrate from cache
  await loadCollection(tasksCollection)
  const memberTaskIds = [...new Set(tasksCollection.toArray.map(t => t.id))].sort()
  await initializePropertiesCollection({ ...membershipParams, memberTaskIds })
  propertiesCollection.startSyncImmediate()

  // 5. Offline executor — must follow collection init so the registered
  //    collections are non-null. waitForInit() restores any pending outbox
  //    transactions from the previous session.
  await initOfflineExecutor()

  if (import.meta.env.DEV) {
    console.log(`[collections] All initialized in ${(performance.now() - t0).toFixed(0)}ms`)
    await debugListOPFSFiles()
  }
}

function AuthenticatedLayout() {
  const { data: session, isPending } = authClient.useSession()
  const navigate = useNavigate()
  const [collectionsReady, setCollectionsReady] = useState(false)
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

  if (isPending || !session) return null
  if (!collectionsReady) return <AuthLoadingComponent />

  return <Outlet />
}
