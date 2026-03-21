import { createFileRoute, Outlet, useNavigate, redirect } from '@tanstack/react-router'
import { authClient } from '../../infrastructure/auth/client'
import { authStateCollection } from '../../infrastructure/database/tanstack-db-electric/authCollections'
import { projectsCollection, buildUnitsCollection, usersCollection, teamsCollection, membershipsCollection } from '../../infrastructure/database/tanstack-db-electric/admincollections'
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
    if (cached?.session && cached.session.expiresAt > new Date()) {
      return cached
    }
    const result = await authClient.getSession()
    const prevUserId = cached?.user?.id
    const newUserId = result.data?.user?.id

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

    // Different user logged in — reload to flush stale Electric collection caches.
    // Same-user re-login is unaffected (prevUserId === newUserId → no reload).
    if (prevUserId && newUserId && prevUserId !== newUserId) {
      window.location.reload()
    }

    return result.data
  },
  loader: async () => {
    // Memberships must load first — other shapes use it for access control
    await membershipsCollection.preload()
    await Promise.all([
      projectsCollection.preload(),
      buildUnitsCollection.preload(),
      usersCollection.preload(),
      teamsCollection.preload(),
    ])
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
