// Framework-free helpers shared by both apps' Electric collection definitions.
// The collection *definitions* stay per-app (persistence engine, project-scoping),
// but these pieces were identical across them — see ARCHITECTURE.md §10.

// Electric returns boolean columns as the string "true"/"false".
export const coerceBool = (v: unknown) => v === `true` || v === true

// --- Garbage collection tiers ---
//
// TanStack DB's GC fires when a collection has no mounted live query, and its
// cleanup ABORTS the Electric shape's long-poll — so GC is the lever for closing
// an idle shape stream. A GC'd collection RESURRECTS the moment a live query
// subscribes again (changes.addSubscriber() restarts sync), and because every
// collection is wrapped in persistedCollectionOptions the restart RESUMES from the
// persisted offset (changes_only) rather than refetching the whole shape.
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
