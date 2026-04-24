import { emailOTPClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"
import { clearAuthCookies, createCookieFetch } from "./cookie-fetch"
import { resetAllCollections } from "../../application/collections/init"
import { disposePersistence } from "../persistence/expo-persistence"

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000"
console.log(">>> AUTH API URL:", apiUrl)
/**
 * Better Auth client for React Native.
 *
 * Uses expo-secure-store to persist session cookies across app restarts.
 * createCookieFetch() intercepts every request to attach stored cookies and
 * every response to persist new Set-Cookie values.
 */
export const authClient = createAuthClient({
  baseURL: apiUrl,
  basePath: "/api/auth",
  plugins: [emailOTPClient()],
  fetchOptions: {
    customFetchImpl: createCookieFetch(),
  },
})

export const { signIn, signOut, getSession, useSession } = authClient
export { clearAuthCookies }

// Signs out and wipes the SQLite persistence cache so the next user logging in
// does not see the previous user's cached rows. The caller must navigate away
// from authenticated screens (unmounting live queries) BEFORE calling this, to
// avoid "collection was cleaned up" errors from active subscriptions.
export async function signOutAndDispose(): Promise<void> {
  // Reset collections and dispose the SQLite DB BEFORE signing out,
  // because authClient.signOut() updates session state which triggers
  // the AuthGuard to navigate to login — at that point the cleanup
  // must already be complete so re-login can init from a clean slate.
  resetAllCollections()
  await disposePersistence()
  // Fire-and-forget: local state is already clean, don't block on
  // a slow/unreachable server. The old session expires naturally.
  authClient.signOut().catch(() => {})
}
