import { createAuthClient } from "better-auth/react"
import { emailOTPClient } from "better-auth/client/plugins"
import { disposePersistence } from "../persistence/browser-persistence"
import { disposeOfflineExecutor } from "../offline/executor"
import { resetTaskActions } from "../../application/actions/tasks"

/**
 * Better Auth Client Configuration
 * 
 * Must match the server configuration for plugin support.
 * The baseURL should point to your API where better-auth is mounted.
 */
export const authClient = createAuthClient({
  // Base URL where the better-auth API is mounted
  // This should match BETTER_AUTH_URL or your API endpoint
  //baseURL: import.meta.env.VITE_BETTER_AUTH_URL || "http://localhost:5173",
  
  // Base path for auth endpoints (default: "/api/auth")
  basePath: "/api/auth",
  
  // Plugins for client-side functionality
  plugins: [
    emailOTPClient(),
  ],
})

// Export typed hooks and utilities from the client
export const {
  signUp,
  signIn,
  signOut,
  getSession,
  revokeSession,
  listSessions,
  useSession,
} = authClient

// Wraps better-auth signOut to also wipe the OPFS persistence cache, so the
// next user logging in on the same browser does not see the previous user's
// cached rows on first paint.
export async function signOutAndDispose(): Promise<void> {
  await authClient.signOut()
  disposeOfflineExecutor()
  resetTaskActions()
  await disposePersistence()
}

// Type exports for use in components
export type Session = typeof authClient.$Infer.Session
export type SessionUser = typeof authClient.$Infer.Session.user

/* *
 * Custom hook for checking if user is authenticated
 */
export function useIsAuthenticated() {
  const { data: session, isPending: isLoading } = useSession()
  return {
    isAuthenticated: !!session,
    isLoading,
    user: session?.user,
  }
}

/**
 * Custom hook for requiring authentication
 * Redirects or returns null if not authenticated
 */
export function useRequireAuth() {
  const { isAuthenticated, user, isLoading } = useIsAuthenticated()
  
  if (isLoading) {
    return { isLoading: true, user: null }
  }
  
  if (!isAuthenticated) {
    return { isLoading: false, user: null }
  }
  
  return { isLoading: false, user }
}
