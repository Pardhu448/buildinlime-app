import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import LoginPage from '../pages/LoginPage'
import { useRequireAuth } from '../../infrastructure/auth/client'

export const Route = createFileRoute('/login')({
  head: () => ({
    meta: [{ title: 'Login - BuildInLime' }],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    returnTo: (search.returnTo as string) || '/',
    mode: (search.mode as string) === 'signup' ? 'signup' : 'login',
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
