import { createFileRoute, Outlet, useNavigate, redirect } from '@tanstack/react-router'
import { authClient } from '../../infrastructure/auth/client'
import { authStateCollection } from '../../infrastructure/database/tanstack-db-electric/authCollections'
import { projectsCollection, buildUnitsCollection, usersCollection, teamsCollection, membershipsCollection } from '../../infrastructure/database/tanstack-db-electric/admincollections'
import { useEffect, useRef } from 'react'

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
  const prevUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isPending && !session) {
      navigate({ to: '/login' })
      return
    }
    if (session?.user?.id) {
      if (prevUserIdRef.current !== null && prevUserIdRef.current !== session.user.id) {
        // User switched — reload to clear stale Electric collection caches
        window.location.reload()
        return
      }
      prevUserIdRef.current = session.user.id
    }
  }, [session, isPending, navigate])

  if (isPending || !session) return null

  return <Outlet />
}
