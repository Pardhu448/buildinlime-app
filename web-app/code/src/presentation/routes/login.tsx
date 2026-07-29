import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import LoginPage from '../pages/LoginPage'
import { useRequireAuth } from '../../infrastructure/auth/client'

export const Route = createFileRoute('/login')({
  head: () => ({
    meta: [{ title: 'Login - BuildInLime' }],
  }),
  // `email` is OPTIONAL, and the return type says so explicitly. Inferring it as
  // a required string would make every existing Link to /login a type error for
  // omitting it — the header, the mobile menu, and the _authenticated bounce all
  // navigate here with only returnTo + mode, and none of them has an address to
  // offer.
  validateSearch: (
    search: Record<string, unknown>,
  ): { returnTo: string; mode: 'signup' | 'login'; email?: string } => ({
    returnTo: (search.returnTo as string) || '/',
    mode: (search.mode as string) === 'signup' ? 'signup' : 'login',
    // Carried over by the mobile app when its sign-in finds no account for the
    // address (mobile-app/app/(auth)/login.tsx) — signup is web-only, so the
    // handoff brings the address across rather than making it be typed twice.
    // Prefill only: the form still validates and submits it like any other
    // input, so a hand-crafted value gets no special treatment.
    ...((search.email as string) ? { email: search.email as string } : {}),
  }),
  component: LoginRoute,
})

function LoginRoute() {
  const { user, isLoading } = useRequireAuth()
  const navigate = useNavigate()
  const initialCheckDone = useRef(false)

  if (!isLoading) {
    initialCheckDone.current = true
  }

  useEffect(() => {
    if (!isLoading && user) {
      navigate({ to: '/' })
    }
  }, [user, isLoading, navigate])

  // Only show spinner during the very first session check
  if (!initialCheckDone.current) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  // Spinner while navigate() takes effect after confirmed login
  if (user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return <LoginPage />
}
