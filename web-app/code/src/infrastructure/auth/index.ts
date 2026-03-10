// Auth Infrastructure Exports
// NOTE: Only client-safe exports here. Import server.ts directly in server-only contexts.

export {
  authClient,
  signUp,
  signIn,
  signOut,
  useSession,
  getSession,
  revokeSession,
  listSessions,
  useSession as useAuthSession,
  getSession as getAuthSession,
} from "./client"

export type { Session, SessionUser } from "./client"
export { useIsAuthenticated, useRequireAuth } from "./client"
