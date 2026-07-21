// Framework-free helpers shared by both apps' Electric collection definitions,
// plus the factory that builds the definitions themselves — see ARCHITECTURE.md §10.

// The wire coercions live with the row schemas that use them, in the contracts
// package; re-exported here because both apps' collections/_shared.ts have always
// sourced them from sync-core.
export { coerceBool, unwrapJsonb } from "@buildinlime/contracts"

// --- Garbage collection tiers ---
//
// TanStack DB's GC fires when a collection has no mounted live query, and its
// cleanup ABORTS the Electric shape's long-poll — so GC is the lever for closing
// an idle shape stream. A GC'd collection RESURRECTS the moment a live query
// subscribes again (changes.addSubscriber() restarts sync when the status is
// `cleaned-up`/`idle`), and because every collection is wrapped in
// persistedCollectionOptions the restart RESUMES from the persisted offset
// (changes_only) rather than refetching the whole shape.
//
// Resurrection is load-bearing for the IDLE_GC tier, and it is verified, not
// assumed: an earlier troubleshooting note (agentGuides/mobileAppSetupTroubleshoot
// "Issue 6") claimed a GC-aborted shape stays dead for the session, which would
// make this tier a data-loss bug. That was re-tested on 2026-07-16 against the
// two-tier GC — idle past the window, then write from the other client — and the
// stream resumes. Note the subtlety it turned on: resurrection is driven by
// addSubscriber, so it needs a live query. startSyncImmediate or a bare .get()
// will NOT revive a GC'd collection.
//
// Two tiers result:
//   NEVER_GC   — collections an always-mounted subscriber holds for the whole
//                session (the sidebar/drawer spine + the tiny badge slices), so GC
//                would never fire anyway. A non-finite gcTime makes startGCTimer()
//                skip scheduling.
//   IDLE_GC_MS — heavy, screen-scoped collections (messages/tasks/properties/
//                resources) that genuinely go idle; their long-poll closes this many
//                ms after the last live query unmounts and resumes on the next visit.
// The per-app payoff differs (mobile's project-scoped shapes idle harder) — see
// ARCHITECTURE.md §6.
export const NEVER_GC = Infinity
export const IDLE_GC_MS = 60_000

// --- Electric shape retry + memberships error tracking ---
//
// electric-db-collection calls markReady() from its shape ERROR path, not only on
// up-to-date — deliberately, so a failing shape can't hang an app blocked on
// preload(). The consequence: `collection.isReady()` means "the first sync finished
// OR gave up", and a collection whose shape 401'd/500'd is `ready` with ZERO rows,
// indistinguishable from a user who genuinely belongs to no channels.
//
// For memberships that distinction is load-bearing: the bootstrap derives its id
// sets from those rows, and an empty set reaches the shape routes as `1 = 0` — no
// messages/tasks/resources for the rest of the session. So the memberships shape
// reports its errors here, and the bootstrap treats "ready + zero rows + errored"
// as NOT LOADED (a clean empty sync is trusted immediately — a new user really has
// no memberships). See ARCHITECTURE.md §6.
export interface ShapeRetry {
  /** Electric shape onError handler: retry after a delay (401 → 2s, else 5s). */
  retryOnError: (error: Error) => Promise<void>
  /** As retryOnError, but also records the error for the memberships shape. */
  retryOnMembershipsError: (error: Error) => Promise<void>
  membershipsShapeErrored: () => boolean
  clearMembershipsShapeError: () => void
}

// Each app calls this ONCE at module load (in its collections/_shared) so the
// memberships-error flag is a per-app singleton, exactly as before. `log` is
// injected because a repeating retry line is the only outward sign a shape is stuck
// — mobile wires it to __DEV__ console.log; web omits it.
export function makeShapeRetry(log?: (message: string) => void): ShapeRetry {
  let membershipsError: Error | null = null

  const retryOnError = async (error: Error) => {
    log?.(`[shape-retry] ${error?.message ?? String(error)}`)
    const delay = error.message.includes(`401`) ? 2000 : 5000
    await new Promise((resolve) => setTimeout(resolve, delay))
  }

  const retryOnMembershipsError = async (error: Error) => {
    membershipsError = error
    return retryOnError(error)
  }

  return {
    retryOnError,
    retryOnMembershipsError,
    membershipsShapeErrored: () => membershipsError !== null,
    clearMembershipsShapeError: () => {
      membershipsError = null
    },
  }
}

// --- The collection factory -------------------------------------------------
//
// Every persisted Electric collection in both apps is the same sandwich:
//
//   createCollection(persistedCollectionOptions({
//     ...electricCollectionOptions({ id, shapeOptions, schema, getKey, gcTime, …handlers }),
//     persistence, schemaVersion,
//   }) as any)
//
// …repeated a dozen times per app, differing only in the spec below. Four things
// genuinely vary BETWEEN the apps — the persistence engine, the base URL, the
// timestamp/int8 parser, and mobile's need for an explicit fetchClient — and those
// are the runtime injected once per app, exactly like the action factories take
// their platform primitives (see platform.ts).
//
// The tanstack builders are injected rather than imported so sync-core stays free
// of a dependency on either persistence package (browser-db-sqlite-persistence vs
// expo-db-sqlite-persistence) — the one thing that could not be shared.
//
// This builds the OPTIONS ONLY; each app still calls createCollection itself, in
// the one-line defineCollection wrapper in its collections/_shared.ts. That split
// is deliberate: the options types do not compose without an `as any`, and it is
// the app's own createCollection that turns that back into a properly typed
// Collection. Returning a finished collection from here would erase the row types
// at all ~110 call sites.

/**
 * EVERY collection's schemaVersion MUST be equal, which is why it lives here and
 * is NOT part of the per-collection spec.
 *
 * Adapters are cached keyed by schemaVersion, and the persistence coordinator holds
 * ONE adapter across all collections. A lone differing value spawns a second adapter
 * that overwrites the coordinator's, which then drives every other collection's
 * offset through the wrong namespace and strands them on reload — Electric reports
 * "up-to-date" while nothing renders. This actually happened when properties was
 * bumped to 2 alone.
 *
 * Bumping this constant re-syncs every collection from scratch on both apps, which
 * is the point: bump it whenever any row schema changes shape, so cached rows that
 * predate the change are discarded rather than validated as undefined.
 */
export const COLLECTION_SCHEMA_VERSION = 4

/** The tanstack builders + per-app primitives a collection definition needs. */
export interface CollectionRuntime {
  /** @tanstack/electric-db-collection */
  electricCollectionOptions: (config: never) => object
  /** @tanstack/{browser,expo}-db-sqlite-persistence */
  persistedCollectionOptions: (config: never) => object
  /** Web: window.location.origin. Mobile: EXPO_PUBLIC_API_URL. */
  baseUrl: string
  /** Electric column parser overrides (mobile normalises timestamps for Hermes). */
  parser: Record<string, (value: never) => unknown>
  /** Mobile only: RN's fetch has no cookie jar, so shapes need the wrapped client. */
  fetchClient?: (input: never, init?: never) => Promise<Response>
  /** Default shape onError. Memberships overrides it — see makeShapeRetry. */
  retryOnError: (error: Error) => Promise<void>
}

export interface CollectionSpec {
  /** Collection id AND its persistence namespace. Must be stable across releases. */
  id: string
  /** Shape route path, e.g. "/api/tasks". */
  path: string
  /**
   * Membership-derived id sets baked into the shape URL, so the server does not
   * re-scan the memberships table on every long-poll. An empty or absent set omits
   * the parameter entirely — the routes read "no parameter" as "unscoped", NOT as
   * the empty set, so passing `[]` must not produce `?ids=`.
   */
  params?: Record<string, string[] | undefined>
  /** A row schema from @buildinlime/contracts. */
  schema: unknown
  getKey: (item: never) => string
  /** NEVER_GC or IDLE_GC_MS — see the tier note above. */
  gcTime: number
  /** Overrides runtime.retryOnError (memberships reports before retrying). */
  onError?: (error: Error) => Promise<void>
  /**
   * The app's persistence handle. Per-call rather than on the runtime because web
   * resolves it asynchronously and mobile synchronously.
   */
  persistence: unknown
  /**
   * onInsert / onUpdate / onDelete. Most collections pass none: writes go through
   * @tanstack/offline-transactions (application/actions/*), and a missing handler
   * makes a direct collection.insert() fail loudly, which is the intended design.
   */
  handlers?: Record<string, unknown>
}

export function makeCollectionOptionsBuilder(runtime: CollectionRuntime) {
  return function buildCollectionOptions(spec: CollectionSpec): object {
    const url = new URL(spec.path, runtime.baseUrl)
    for (const [key, ids] of Object.entries(spec.params ?? {})) {
      if (ids && ids.length > 0) url.searchParams.set(key, ids.join(`,`))
    }

    return runtime.persistedCollectionOptions({
      ...runtime.electricCollectionOptions({
        id: spec.id,
        shapeOptions: {
          url: url.toString(),
          ...(runtime.fetchClient ? { fetchClient: runtime.fetchClient } : {}),
          onError: spec.onError ?? runtime.retryOnError,
          parser: runtime.parser,
        },
        schema: spec.schema,
        getKey: spec.getKey,
        gcTime: spec.gcTime,
        ...spec.handlers,
      } as never),
      persistence: spec.persistence,
      schemaVersion: COLLECTION_SCHEMA_VERSION,
    } as never)
  }
}
