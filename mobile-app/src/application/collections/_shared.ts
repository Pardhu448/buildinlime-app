import { createCookieFetch } from "../../infrastructure/auth/cookie-fetch"

export const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000"
export const cookieFetch = createCookieFetch()

// Disable TanStack DB garbage collection on these Electric collections.
//
// GC (default gcTime 5 min) fires when a collection has no mounted live query,
// and its cleanup ABORTS the Electric shape's long-poll (electric-db-collection
// aborts the fetch on cleanup). Because the app starts sync imperatively once
// via startSyncImmediate() and never restarts it, a GC'd collection goes
// permanently silent — no inbound sync, and optimistic writes are dropped on
// commit with nothing to redeliver them. On mobile the drawer/leaf-screen
// navigation routinely leaves collections with zero subscribers, so this bites
// (the web app dodges it only because a persistent sidebar keeps them
// subscribed). These collections are session-scoped and torn down explicitly
// (cleanup on project switch / reset), so GC is both redundant and harmful.
// A non-finite gcTime makes startGCTimer() skip scheduling (see @tanstack/db).
export const NEVER_GC = Infinity

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
