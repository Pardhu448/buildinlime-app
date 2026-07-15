import { createCookieFetch } from "../../infrastructure/auth/cookie-fetch"

export const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000"
export const cookieFetch = createCookieFetch()

// GC (garbage collection) fires when a collection has no mounted live query,
// and its cleanup ABORTS the Electric shape's long-poll — so GC is precisely the
// lever for closing an idle shape stream.
//
// HISTORY / CORRECTION: this used to be blanket-disabled everywhere on the claim
// that "the app starts sync once and never restarts it, so a GC'd collection
// goes permanently silent". That is NO LONGER TRUE. The monorepo resolves
// @tanstack/db@0.6.5 (one root lockfile; web verified this): changes
// .addSubscriber() calls sync.startSync() whenever a collection in status
// `cleaned-up` (or `idle`) gains a subscriber, and the lifecycle allows the
// `cleaned-up → loading` transition. So a GC'd collection RESURRECTS the moment a
// live query subscribes again, and — because these collections are wrapped in
// persistedCollectionOptions — the restart RESUMES from the persisted SQLite
// offset (changes_only) rather than refetching the whole shape. Optimistic
// writes are unaffected: they replay through the offline-transactions outbox, not
// the collection's own sync.
//
// This makes idle-GC MORE valuable on mobile than on web, for two compounding
// reasons the web app doesn't get:
//   1. The drawer/leaf-screen navigation routinely leaves collections with ZERO
//      subscribers (a channel closed, a sheet dismissed). Web's persistent
//      sidebar kept the spine warm and rarely idled; mobile idles constantly, so
//      GC actually gets to fire and close streams.
//   2. Mobile is PROJECT-SCOPED — messages/tasks/resources/properties are built
//      for the SELECTED project's channels only (see collections/init.ts), where
//      web scopes them to every channel across every project. So a resurrected
//      shape resumes a project-bounded row set, not the whole membership, and the
//      live working set is bounded by (current project × current screen) — a
//      two-dimensional reduction where web gets only the screen dimension.
//
// NEVER_GC is therefore no longer a correctness requirement; it is kept only
// where an always-mounted subscriber holds a collection for the whole session,
// so GC would never fire ANYWAY:
//   - the spine (projects/buildUnits/channels/users/teams/memberships): the
//     Drawer keeps them subscribed the whole session.
//   - reads: the always-mounted DrawerContent badges scan it (and messages/tasks)
//     for unread counts, so those three are pinned too — until the badge rework
//     (tiny inbox_mentions/my_tasks shapes + seen_state) lands, mirroring web.
// A non-finite gcTime makes startGCTimer() skip scheduling (see @tanstack/db).
export const NEVER_GC = Infinity

// GC delay for collections that GENUINELY go idle (no always-mounted subscriber)
// AND are persisted (so resurrection resumes from the SQLite offset, not a full
// refetch). The shape's long-poll closes this many ms after the last live query
// unmounts, and re-subscribing on the next visit transparently restarts + resumes
// it. Applied to properties and resources today: nothing always-mounted holds
// them (only channel / build-unit / task / sheet screens subscribe), so they
// stream only while those views are open. messages/tasks will join once the
// DrawerContent badge pin above is removed. 60s balances closing idle streams
// against resume round-trips when navigating quickly.
export const IDLE_GC_MS = 60_000

// Stop an Electric collection's sync and release its shape + SQLite handles.
// With GC disabled (NEVER_GC), nothing auto-stops an orphaned collection, so
// callers MUST cleanup() the previous instance before replacing it (project
// switch, resync) or on teardown (reset) — otherwise its long-poll leaks.
// Guarded so a double-cleanup or a never-synced/null collection can't throw.
export function safeCleanup(
  collection: { cleanup?: () => unknown } | null | undefined,
): void {
  try {
    collection?.cleanup?.()
  } catch {
    // best-effort — the instance is being discarded anyway
  }
}

export const retryOnError = async (error: Error) => {
  // Kept deliberately. A shape that fails is otherwise SILENT — electric-db-collection
  // marks the collection ready from this very error path, so the app carries on as if
  // the shape had synced, just with no rows (see retryOnMembershipsError). A repeating
  // line here is the only outward sign that a shape is stuck retrying and never
  // advancing, and it is what identifies which one.
  if (__DEV__) console.log(`[shape-retry] ${error?.message ?? String(error)}`)
  const delay = error.message.includes("401") ? 2000 : 5000
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
// For memberships that distinction is load-bearing. Both bootstrap phases derive
// their id sets from these rows, and an empty set reaches the shape routes as
// `1 = 0` — literally no messages, tasks or resources for the rest of the
// session. Owners still see their projects and channels via the `owner_id = me`
// escape clause, so the app looks alive while every channel is empty.
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

export const coerceBool = (v: unknown) => v === "true" || v === true
export const unwrapJsonb = (v: unknown) =>
  typeof v === "string" && v.startsWith('"') ? JSON.parse(v) : v

// Hermes (React Native) cannot parse PostgreSQL's timestamp format
// "2024-01-15 10:30:00.123456+00" — it needs strict ISO 8601 with 'T' separator.
const normalizeTs = (d: string) =>
  d.replace(" ", "T").replace(/\+00(?::00)?$/, "Z")

export const parser = {
  timestamptz: (d: string) => new Date(normalizeTs(d)),
  // int8 (resources.file_size_bytes) arrives as a string, and Electric's DEFAULT
  // parser turns it into a BigInt. A BigInt cannot be JSON.stringify'd, and the
  // offline outbox persists each mutation's row as JSON — so deleting an attachment
  // died with "Do not know how to serialize a BigInt" before it ever reached the
  // server. Parse to a plain number instead: exact to 2^53, i.e. ~9 petabytes.
  //
  // The zod preprocess on file_size_bytes does NOT cover this — schema validation
  // runs on client mutations, not on rows arriving from sync.
  int8: (v: string) => Number(v),
}
