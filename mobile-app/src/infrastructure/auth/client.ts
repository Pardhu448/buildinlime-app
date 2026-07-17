import { emailOTPClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"
import { clearAuthCookies, createCookieFetch } from "./cookie-fetch"
import { resetAllCollections } from "../../application/collections/init"
import { disposePersistence } from "../persistence/expo-persistence"
import { disposeOfflineExecutor } from "../offline/executor"
import { disposeOutboxDb } from "../offline/storage"
import { disposeUploadManager } from "../offline/upload-manager"
import { disposeOnlineDetector } from "../offline/online-detector"
import { resetAllOfflineActions } from "../../application/actions"

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000"
if (__DEV__) console.log(`[auth] API URL: ${apiUrl}`)
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
// does not see the previous user's cached rows.
//
// The caller must navigate away from authenticated screens BEFORE calling this,
// AND then wait for the unmounted live queries to actually be released — see
// waitForLiveQueryRelease in app/_layout.tsx. Unmounting alone is not enough:
// a live query stays registered as a dependent of its source collections until
// it is GC'd, and cleanup() on a source with a live dependent errors with
// "source collection was manually cleaned up while live query depends on it".
export async function signOutAndDispose(): Promise<void> {
  // Reset collections and dispose the SQLite DB BEFORE signing out,
  // because authClient.signOut() updates session state which triggers
  // the AuthGuard to navigate to login — at that point the cleanup
  // must already be complete so re-login can init from a clean slate.
  disposeOfflineExecutor()
  // Dispose the upload manager BEFORE disposePersistence() — it deletes its
  // pending_attachments rows from the main DB and removes copied local files.
  await disposeUploadManager()
  // Both connectivity consumers (executor + upload manager) are gone now, so
  // the shared detector can be torn down for real.
  disposeOnlineDetector()
  resetAllOfflineActions()
  resetAllCollections()
  await disposePersistence()
  // Outbox lives in its own DB — dispose it after the executor is gone so the
  // next user's session doesn't replay this user's pending mutations.
  await disposeOutboxDb()
  // Fire-and-forget: local state is already clean, don't block on
  // a slow/unreachable server. The old session expires naturally.
  authClient.signOut().catch(() => {})
}
