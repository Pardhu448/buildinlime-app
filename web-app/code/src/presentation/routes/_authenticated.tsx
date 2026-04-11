import { createFileRoute, Outlet, useNavigate, redirect } from '@tanstack/react-router'
import { authClient } from '../../infrastructure/auth/client'
import { authStateCollection } from '../../infrastructure/database/tanstack-db-electric/authCollections'
import { projectsCollection, buildUnitsCollection, usersCollection, teamsCollection, membershipsCollection, initializeOrganizationCollections } from '../../infrastructure/database/tanstack-db-electric/admincollections'
import { initializeCommunicationCollections, initializePropertiesCollection, tasksCollection, propertiesCollection } from '../../application/collections/communication'
import { useEffect } from 'react'

function AuthLoadingComponent() {
  return (
    <div className="flex h-screen items-center justify-center text-[#717182] font-['Instrument_Sans',sans-serif]">
      Loading…
    </div>
  )
}

export const Route = createFileRoute('/_authenticated')({
  ssr: false, // Only run on client — avoids SSR fetch through Caddy with untrusted cert
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

    // Collection init must happen here, not in loader: child route loaders run
    // in parallel with _authenticated's loader, so if init lived in loader the
    // children would race and hit null.preload(). beforeLoad runs sequentially
    // parent-before-child and completes before any loader starts.
    await membershipsCollection.preload()

    const memberships = membershipsCollection.toArray
    const memberProjectIds = [...new Set(memberships.map(m => m.project_id))].sort()
    const memberBuildunitIds = [...new Set(memberships.map(m => m.buildunit_id))].sort()
    const memberChannelIds = [...new Set(memberships.map(m => m.channel_id))].sort()

    const membershipParams = { memberProjectIds, memberBuildunitIds, memberChannelIds }
    initializeOrganizationCollections(membershipParams)
    initializeCommunicationCollections({ memberChannelIds })

    // Tasks must preload before propertiesCollection is initialized — its shape
    // URL bakes in task IDs to let the server skip per-poll tasksTable scans.
    await Promise.all([
      projectsCollection.preload(),
      buildUnitsCollection.preload(),
      usersCollection.preload(),
      teamsCollection.preload(),
      tasksCollection.preload(),
    ])

    const memberTaskIds = [...new Set(tasksCollection.toArray.map(t => t.id))].sort()
    initializePropertiesCollection({ ...membershipParams, memberTaskIds })
    await propertiesCollection.preload()

    return sessionData
  },
  pendingComponent: AuthLoadingComponent,
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { data: session, isPending } = authClient.useSession()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isPending && !session) {
      navigate({ to: '/login' })
    }
  }, [session, isPending, navigate])

  if (isPending || !session) return null

  return <Outlet />
}
