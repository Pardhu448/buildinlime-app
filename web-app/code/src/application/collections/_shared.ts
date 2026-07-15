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

// GC (garbage collection) fires when a collection has no mounted live query,
// and its cleanup ABORTS the Electric shape's long-poll — so GC is precisely the
// lever for closing idle shape streams.
//
// HISTORY / CORRECTION: this used to be blanket-disabled everywhere on the claim
// that "sync is started once and never restarted, so a GC'd collection goes
// permanently silent". That is NO LONGER TRUE. Verified against the installed
// @tanstack/db@0.6.5: changes.addSubscriber() calls sync.startSync() whenever a
// collection in status `cleaned-up` (or `idle`) gains a subscriber, and
// lifecycle allows the `cleaned-up → loading` transition. So a GC'd collection
// RESURRECTS the moment a live query subscribes to it again. If it is also
// wrapped in persistedCollectionOptions, the restart RESUMES from the persisted
// offset (changes_only) rather than refetching the whole shape — cheap.
//
// NEVER_GC is therefore no longer a correctness requirement; it is kept only
// where GC would never fire ANYWAY, because an always-mounted subscriber holds
// the collection for the whole session:
//   - spine (projects/buildUnits/channels/users/teams): the persistent <Sidebar>
//     keeps them subscribed for the whole session, so they never idle.
//   - seen-state, inbox-mentions, my-tasks: the always-mounted Sidebar badges
//     subscribe to these tiny user-scoped collections for the whole session, so
//     they never idle. (These REPLACED the old full-collection badge scans; that
//     rework is exactly what freed messages/tasks below to idle-GC.)
// messages, tasks, properties and resources are now IDLE_GC_MS (see below) —
// nothing always-mounted holds them anymore. (resources was the last holdout,
// kept eager until its persistence path was validated.)
export const NEVER_GC = Infinity

// GC delay for collections that GENUINELY go idle (no always-mounted subscriber)
// AND are persisted (so resurrection resumes from offset, not a full refetch).
// The shape's long-poll closes this many ms after the last live query unmounts,
// and re-subscribing on the next visit transparently restarts + resumes it.
// Applied to properties / messages / tasks: nothing outside the channel /
// build-unit / task / inbox routes subscribes to them, so they stream only while
// those views are open. Tunable — shorter closes idle streams sooner at the cost
// of more resume round-trips when navigating quickly; 60s balances the two.
export const IDLE_GC_MS = 60_000

// Electric returns boolean columns as the string "true"/"false".
export const coerceBool = (v: unknown) => v === "true" || v === true

export const origin = typeof window !== `undefined`
  ? window.location.origin
  : `https://localhost:5173`
