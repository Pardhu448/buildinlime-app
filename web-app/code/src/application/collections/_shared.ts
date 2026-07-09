// Shared helpers used across Electric collection files.

// Retry handler for Electric shape fetch errors.
// Returning (not throwing) causes Electric to retry the shape fetch.
// - 401: session not ready yet → retry after 2s
// - other errors: retry after 5s
export const retryOnError = async (error: Error) => {
  const delay = error.message.includes(`401`) ? 2000 : 5000
  await new Promise((resolve) => setTimeout(resolve, delay))
}

// Disable TanStack DB garbage collection on these Electric collections.
//
// GC (default gcTime 5 min) fires when a collection has no mounted live query,
// and its cleanup ABORTS the Electric shape's long-poll (electric-db-collection
// aborts the fetch on cleanup). Sync is started once via startSyncImmediate()
// and never restarted, so a GC'd collection goes permanently silent: no inbound
// rows arrive until a local write forces a catch-up fetch. The persistent
// <Sidebar> keeps projects/buildUnits/channels/users/teams subscribed, but
// messages/tasks/resources/properties routinely hit zero subscribers (any view
// without a CommentsSection), so they GC and stall. These collections are
// session-scoped and torn down explicitly on resync (see _authenticated.tsx),
// so GC is both redundant and harmful. A non-finite gcTime makes
// startGCTimer() skip scheduling (see @tanstack/db).
export const NEVER_GC = Infinity

// Electric returns boolean columns as the string "true"/"false".
export const coerceBool = (v: unknown) => v === "true" || v === true

export const origin = typeof window !== `undefined`
  ? window.location.origin
  : `https://localhost:5173`
