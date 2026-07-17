/**
 * Wait until the live queries of just-unmounted screens have actually been
 * released, before their source collections are torn down (sign-out disposes them;
 * resync cleanup()s and rebuilds them).
 *
 * Unmounting a screen does NOT release its live queries synchronously. A
 * useLiveQuery collection is garbage-collected on a timer (TanStack sets
 * gcTime = 1ms for them) and then an idle callback — and until that runs it is
 * still registered as a DEPENDENT of every collection it reads. cleanup() /
 * dispose on a source with a live dependent puts that dependent into an error
 * state:
 *
 *   "Source collection '…' was manually cleaned up while live query '…' depends on
 *    it. Live queries prevent automatic GC, so this was likely a manual cleanup()
 *    call."
 *
 * The teardown effects (sign-out in app/_layout, resync in (tabs)/_layout) run in
 * the tick right after the unmount commit — squarely inside that window. So
 * unmounting first is necessary but not sufficient; we also yield past the GC timer
 * and the idle callback that follows it. Worst case this over-waits by a few frames
 * on a view the user is already leaving.
 */
export function waitForLiveQueryRelease(): Promise<void> {
  return new Promise((resolve) => {
    // Past CleanupQueue's microtask + its (1ms) GC timer…
    setTimeout(() => {
      const requestIdle = (
        globalThis as {
          requestIdleCallback?: (
            cb: () => void,
            opts?: { timeout: number },
          ) => void
        }
      ).requestIdleCallback
      // …then past the idle callback that performs the cleanup itself. Ours is
      // queued after theirs, so theirs runs first.
      if (typeof requestIdle === `function`) {
        requestIdle(() => resolve(), { timeout: 200 })
      } else {
        setTimeout(resolve, 0)
      }
    }, 50)
  })
}
