// Shared helpers used across Electric collection files.

// Retry handler for Electric shape fetch errors.
// Returning (not throwing) causes Electric to retry the shape fetch.
// - 401: session not ready yet → retry after 2s
// - other errors: retry after 5s
export const retryOnError = async (error: Error) => {
  const delay = error.message.includes(`401`) ? 2000 : 5000
  await new Promise((resolve) => setTimeout(resolve, delay))
}

// ---------------------------------------------------------------------------
// Memberships shape error tracking.
//
// electric-db-collection calls markReady() from its shape ERROR path, not only
// on up-to-date — deliberately, so a failing shape can't hang an app blocked on
// preload(). The consequence: `collection.isReady()` means "the first sync
// finished OR gave up", and a collection whose shape 401'd/500'd is `ready` with
// ZERO rows, indistinguishable from a user who genuinely belongs to no channels.
//
// For memberships that distinction is load-bearing. The whole bootstrap derives
// its id sets from these rows, and an empty set is sent to the shape routes as
// `1 = 0` — literally no messages, tasks or resources for the rest of the
// session (see api/messages.ts et al). Owners still see their projects and
// channels via the `owner_id = me` escape clause, so the app looks alive while
// every channel is empty.
//
// So the memberships shape reports its errors here, and the bootstrap treats
// "ready + zero rows + errored" as NOT LOADED. A clean empty sync (no error) is
// trusted immediately — a brand-new user really does have no memberships and
// must not be made to wait.
let _membershipsShapeError: Error | null = null

export const membershipsShapeErrored = (): boolean => _membershipsShapeError !== null
export const clearMembershipsShapeError = (): void => {
  _membershipsShapeError = null
}

export const retryOnMembershipsError = async (error: Error) => {
  _membershipsShapeError = error
  return retryOnError(error)
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
